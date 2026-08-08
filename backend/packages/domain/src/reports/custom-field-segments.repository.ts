import type { TenantTx } from "@atlas/db";
import type { SegmentConditionsTree } from "./custom-field-segments.dto";
import {
  buildConditionsPredicate,
  buildUnionPredicates,
  type FieldTypeLookup,
} from "./custom-field-segments.conditions";

export type SegmentRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  visibility: string;
  refresh_mode: string;
  conditions_json: unknown;
  matched_count: number | null;
  previous_matched_count: number | null;
  matched_count_at: Date | null;
  snapshot_batch_id: string | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
  created_by_name: string | null;
};

function mapSegmentRow(row: Record<string, unknown>): SegmentRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    name: String(row["name"]),
    description: row["description"] == null ? null : String(row["description"]),
    visibility: String(row["visibility"]),
    refresh_mode: String(row["refresh_mode"]),
    conditions_json: row["conditions_json"],
    matched_count: row["matched_count"] == null ? null : Number(row["matched_count"]),
    previous_matched_count:
      row["previous_matched_count"] == null ? null : Number(row["previous_matched_count"]),
    matched_count_at: (row["matched_count_at"] as Date | null) ?? null,
    snapshot_batch_id:
      row["snapshot_batch_id"] == null ? null : String(row["snapshot_batch_id"]),
    created_by_membership_id: String(row["created_by_membership_id"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
    created_by_name: row["created_by_name"] == null ? null : String(row["created_by_name"]),
  };
}

export const customFieldSegmentsRepository = {
  async listFieldTypes(tx: TenantTx): Promise<FieldTypeLookup> {
    const rows = await tx.$queryRaw<Array<{ key: string; field_type: string }>>`
      select key, field_type
      from custom_field_definitions
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = 'ACTIVE'
    `;
    return new Map(rows.map((row) => [row.key, row.field_type]));
  },

  async listFieldLabels(tx: TenantTx): Promise<Map<string, string>> {
    const rows = await tx.$queryRaw<Array<{ key: string; label: string }>>`
      select key, label
      from custom_field_definitions
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = 'ACTIVE'
    `;
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.key, row.label);
      map.set(`custom:${row.key}`, row.label);
    }
    const learnerLabels: Array<[string, string]> = [
      ["learner:learner_name", "Learner"],
      ["learner:email", "Email"],
      ["learner:enrollment_count", "Enrolments"],
      ["learner:total_spent_cents", "Total spent"],
      ["learner:last_active_at", "Last active"],
      ["learner:signed_up_at", "Signed up"],
      ["learner:status", "Status"],
      ["learner_name", "Learner"],
      ["email", "Email"],
      ["enrollment_count", "Enrolments"],
      ["total_spent_cents", "Total spent"],
      ["last_active_at", "Last active"],
      ["signed_up_at", "Signed up"],
      ["status", "Status"],
    ];
    for (const [key, label] of learnerLabels) map.set(key, label);
    return map;
  },

  async listSegments(tx: TenantTx, actorMembershipId: string): Promise<SegmentRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        s.id::text as id,
        s.tenant_id::text as tenant_id,
        s.name,
        s.description,
        s.visibility,
        s.refresh_mode,
        s.conditions_json,
        s.matched_count,
        s.previous_matched_count,
        s.matched_count_at,
        s.snapshot_batch_id::text as snapshot_batch_id,
        s.created_by_membership_id::text as created_by_membership_id,
        s.created_at,
        s.updated_at,
        coalesce(mp.display_name, ap.email, creator.invited_email_normalized) as created_by_name
      from custom_field_segments s
      left join memberships creator on creator.id = s.created_by_membership_id
      left join member_profiles mp
        on mp.membership_id = creator.id and mp.tenant_id = s.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = creator.auth_principal_id
      where s.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          s.visibility = 'shared'
          or s.created_by_membership_id = ${actorMembershipId}::uuid
        )
      order by s.updated_at desc, s.name asc
    `;
    return rows.map(mapSegmentRow);
  },

  async getSegment(
    tx: TenantTx,
    segmentId: string,
    actorMembershipId: string,
  ): Promise<SegmentRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        s.id::text as id,
        s.tenant_id::text as tenant_id,
        s.name,
        s.description,
        s.visibility,
        s.refresh_mode,
        s.conditions_json,
        s.matched_count,
        s.previous_matched_count,
        s.matched_count_at,
        s.snapshot_batch_id::text as snapshot_batch_id,
        s.created_by_membership_id::text as created_by_membership_id,
        s.created_at,
        s.updated_at,
        coalesce(mp.display_name, ap.email, creator.invited_email_normalized) as created_by_name
      from custom_field_segments s
      left join memberships creator on creator.id = s.created_by_membership_id
      left join member_profiles mp
        on mp.membership_id = creator.id and mp.tenant_id = s.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = creator.auth_principal_id
      where s.tenant_id = current_setting('app.tenant_id', true)::uuid
        and s.id = ${segmentId}::uuid
        and (
          s.visibility = 'shared'
          or s.created_by_membership_id = ${actorMembershipId}::uuid
        )
      limit 1
    `;
    return rows[0] ? mapSegmentRow(rows[0]) : null;
  },

  async insertSegment(
    tx: TenantTx,
    args: {
      id: string;
      name: string;
      description: string | null;
      visibility: string;
      refreshMode: string;
      conditionsJson: unknown;
      matchedCount: number | null;
      previousMatchedCount: number | null;
      matchedCountAt: Date | null;
      snapshotBatchId: string | null;
      createdByMembershipId: string;
    },
  ): Promise<SegmentRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into custom_field_segments (
        id,
        tenant_id,
        name,
        description,
        visibility,
        refresh_mode,
        conditions_json,
        matched_count,
        previous_matched_count,
        matched_count_at,
        snapshot_batch_id,
        created_by_membership_id
      ) values (
        ${args.id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.name},
        ${args.description},
        ${args.visibility},
        ${args.refreshMode},
        ${JSON.stringify(args.conditionsJson)}::jsonb,
        ${args.matchedCount},
        ${args.previousMatchedCount},
        ${args.matchedCountAt},
        ${args.snapshotBatchId}::uuid,
        ${args.createdByMembershipId}::uuid
      )
      returning
        id::text as id,
        tenant_id::text as tenant_id,
        name,
        description,
        visibility,
        refresh_mode,
        conditions_json,
        matched_count,
        previous_matched_count,
        matched_count_at,
        snapshot_batch_id::text as snapshot_batch_id,
        created_by_membership_id::text as created_by_membership_id,
        created_at,
        updated_at,
        null::text as created_by_name
    `;
    return mapSegmentRow(rows[0]!);
  },

  async updateSegment(
    tx: TenantTx,
    args: {
      id: string;
      name?: string;
      description?: string | null;
      visibility?: string;
      refreshMode?: string;
      conditionsJson?: unknown;
      matchedCount?: number | null;
      previousMatchedCount?: number | null;
      matchedCountAt?: Date | null;
      snapshotBatchId?: string | null;
    },
  ): Promise<SegmentRow | null> {
    const existing = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        tenant_id::text as tenant_id,
        name,
        description,
        visibility,
        refresh_mode,
        conditions_json,
        matched_count,
        previous_matched_count,
        matched_count_at,
        snapshot_batch_id::text as snapshot_batch_id,
        created_by_membership_id::text as created_by_membership_id,
        created_at,
        updated_at,
        null::text as created_by_name
      from custom_field_segments
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${args.id}::uuid
      limit 1
    `;
    if (!existing[0]) return null;
    const current = mapSegmentRow(existing[0]);

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update custom_field_segments set
        name = ${args.name ?? current.name},
        description = ${args.description === undefined ? current.description : args.description},
        visibility = ${args.visibility ?? current.visibility},
        refresh_mode = ${args.refreshMode ?? current.refresh_mode},
        conditions_json = ${JSON.stringify(args.conditionsJson ?? current.conditions_json)}::jsonb,
        matched_count = ${args.matchedCount === undefined ? current.matched_count : args.matchedCount},
        previous_matched_count = ${
          args.previousMatchedCount === undefined
            ? current.previous_matched_count
            : args.previousMatchedCount
        },
        matched_count_at = ${
          args.matchedCountAt === undefined ? current.matched_count_at : args.matchedCountAt
        },
        snapshot_batch_id = ${
          args.snapshotBatchId === undefined
            ? current.snapshot_batch_id
            : args.snapshotBatchId
        }::uuid,
        updated_at = now()
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${args.id}::uuid
      returning
        id::text as id,
        tenant_id::text as tenant_id,
        name,
        description,
        visibility,
        refresh_mode,
        conditions_json,
        matched_count,
        previous_matched_count,
        matched_count_at,
        snapshot_batch_id::text as snapshot_batch_id,
        created_by_membership_id::text as created_by_membership_id,
        created_at,
        updated_at,
        null::text as created_by_name
    `;
    return rows[0] ? mapSegmentRow(rows[0]) : null;
  },

  async deleteSegment(tx: TenantTx, segmentId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from custom_field_segments
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${segmentId}::uuid
      returning id::text as id
    `;
    return rows.length > 0;
  },

  async countScheduleDependencies(tx: TenantTx, segmentId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from report_schedules
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and params_json::text like '%' || ${segmentId} || '%'
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countMatching(
    tx: TenantTx,
    tree: SegmentConditionsTree,
    fieldTypes: FieldTypeLookup,
  ): Promise<number | null> {
    const predicate = buildConditionsPredicate(tree, fieldTypes);
    if (!predicate) return null;
    const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `
      select count(*)::bigint as count
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${predicate.sql})
      `,
      ...predicate.params,
    );
    return Number(rows[0]?.count ?? 0);
  },

  async countMatchingAny(
    tx: TenantTx,
    trees: SegmentConditionsTree[],
    fieldTypes: FieldTypeLookup,
  ): Promise<number> {
    const predicate = buildUnionPredicates(trees, fieldTypes);
    if (!predicate) return 0;
    const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `
      select count(*)::bigint as count
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${predicate.sql})
      `,
      ...predicate.params,
    );
    return Number(rows[0]?.count ?? 0);
  },

  async listMatchingLearners(
    tx: TenantTx,
    tree: SegmentConditionsTree,
    fieldTypes: FieldTypeLookup,
    limit: number,
  ): Promise<Array<{ membership_id: string; learner_name: string | null; email: string | null }>> {
    const predicate = buildConditionsPredicate(tree, fieldTypes);
    if (!predicate) return [];
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      select
        m.id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${predicate.sql})
      order by coalesce(mp.display_name, ap.email, m.invited_email_normalized) asc nulls last
      limit $${predicate.params.length + 1}::int
      `,
      ...predicate.params,
      limit,
    );
    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : String(row["learner_name"]),
      email: row["email"] == null ? null : String(row["email"]),
    }));
  },

  async listMatchingMembershipIds(
    tx: TenantTx,
    tree: SegmentConditionsTree,
    fieldTypes: FieldTypeLookup,
    limit = 2000,
  ): Promise<string[]> {
    const predicate = buildConditionsPredicate(tree, fieldTypes);
    if (!predicate) return [];
    const rows = await tx.$queryRawUnsafe<Array<{ membership_id: string }>>(
      `
      select m.id::text as membership_id
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${predicate.sql})
      order by coalesce(m.joined_at, m.created_at) desc
      limit $${predicate.params.length + 1}::int
      `,
      ...predicate.params,
      limit,
    );
    return rows.map((row) => row.membership_id);
  },

  async countAllLearners(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from memberships m
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async getMatchedLearnerStats(
    tx: TenantTx,
    membershipIds: string[],
  ): Promise<{
    average_total_spent_cents: number | null;
    average_enrollment_count: number | null;
    active_last_30_days: number;
    currency: string;
  }> {
    if (membershipIds.length === 0) {
      return {
        average_total_spent_cents: null,
        average_enrollment_count: null,
        active_last_30_days: 0,
        currency: "INR",
      };
    }
    const rows = await tx.$queryRawUnsafe<
      Array<{
        average_total_spent_cents: number | null;
        average_enrollment_count: number | null;
        active_last_30_days: bigint;
        currency: string | null;
      }>
    >(
      `
      with matched as (
        select m.id, m.last_active_at
        from memberships m
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and m.id = any($1::uuid[])
      ),
      spent as (
        select
          matched.id as membership_id,
          coalesce(sum(po.amount_cents), 0)::int as total_spent_cents,
          (
            select po2.currency from payment_orders po2
            where po2.membership_id = matched.id
              and po2.tenant_id = current_setting('app.tenant_id', true)::uuid
              and po2.status = 'paid'
            order by po2.paid_at desc nulls last
            limit 1
          ) as currency
        from matched
        left join payment_orders po
          on po.membership_id = matched.id
         and po.tenant_id = current_setting('app.tenant_id', true)::uuid
         and po.status = 'paid'
        group by matched.id
      ),
      enroll as (
        select matched.id as membership_id, count(e.id)::int as enrollment_count
        from matched
        left join enrollments e
          on e.membership_id = matched.id
         and e.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by matched.id
      )
      select
        avg(spent.total_spent_cents)::float8 as average_total_spent_cents,
        avg(enroll.enrollment_count)::float8 as average_enrollment_count,
        count(*) filter (
          where matched.last_active_at >= now() - interval '30 days'
        )::bigint as active_last_30_days,
        coalesce(
          (
            select currency from spent
            where currency is not null
            group by currency
            order by count(*) desc
            limit 1
          ),
          'INR'
        ) as currency
      from matched
      join spent on spent.membership_id = matched.id
      join enroll on enroll.membership_id = matched.id
      `,
      membershipIds,
    );
    const row = rows[0];
    return {
      average_total_spent_cents:
        row?.average_total_spent_cents == null ? null : Number(row.average_total_spent_cents),
      average_enrollment_count:
        row?.average_enrollment_count == null ? null : Number(row.average_enrollment_count),
      active_last_30_days: Number(row?.active_last_30_days ?? 0),
      currency: row?.currency ?? "INR",
    };
  },

  async getSpendHistogram(
    tx: TenantTx,
    membershipIds: string[],
  ): Promise<{
    buckets: Array<{ label: string; count: number }>;
    tenantMedianCents: number | null;
    tenantMedianBucketIndex: number | null;
  }> {
    const edges = [0, 500000, 1000000, 1500000, 2000000, 2500000, 3500000, 5000000, 7500000, 10000000];
    const labels = ["0–5k", "5–10k", "10–15k", "15–20k", "20–25k", "25–35k", "35–50k", "50–75k", "75–100k", "100k+"];

    const tenantMedianRows = await tx.$queryRaw<Array<{ median_cents: number | null }>>`
      with spent as (
        select coalesce(sum(po.amount_cents), 0)::int as total_spent_cents
        from memberships m
        left join payment_orders po
          on po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by m.id
      )
      select percentile_cont(0.5) within group (order by total_spent_cents)::float8 as median_cents
      from spent
    `;
    const tenantMedianCents =
      tenantMedianRows[0]?.median_cents == null ? null : Number(tenantMedianRows[0].median_cents);

    if (membershipIds.length === 0) {
      return {
        buckets: labels.map((label) => ({ label, count: 0 })),
        tenantMedianCents,
        tenantMedianBucketIndex:
          tenantMedianCents == null
            ? null
            : Math.min(
                edges.length - 1,
                edges.findIndex((edge, index) => {
                  const next = edges[index + 1] ?? Number.POSITIVE_INFINITY;
                  return tenantMedianCents >= edge && tenantMedianCents < next;
                }) === -1
                  ? edges.length - 1
                  : edges.findIndex((edge, index) => {
                      const next = edges[index + 1] ?? Number.POSITIVE_INFINITY;
                      return tenantMedianCents >= edge && tenantMedianCents < next;
                    }),
              ),
      };
    }

    const spentRows = await tx.$queryRawUnsafe<Array<{ total_spent_cents: number }>>(
      `
      select coalesce(sum(po.amount_cents), 0)::int as total_spent_cents
      from memberships m
      left join payment_orders po
        on po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.id = any($1::uuid[])
      group by m.id
      `,
      membershipIds,
    );

    const counts = labels.map(() => 0);
    for (const row of spentRows) {
      const cents = Number(row.total_spent_cents);
      let bucket = edges.length - 1;
      for (let i = 0; i < edges.length; i += 1) {
        const next = edges[i + 1] ?? Number.POSITIVE_INFINITY;
        if (cents >= edges[i]! && cents < next) {
          bucket = i;
          break;
        }
      }
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }

    let tenantMedianBucketIndex: number | null = null;
    if (tenantMedianCents != null) {
      tenantMedianBucketIndex = edges.length - 1;
      for (let i = 0; i < edges.length; i += 1) {
        const next = edges[i + 1] ?? Number.POSITIVE_INFINITY;
        if (tenantMedianCents >= edges[i]! && tenantMedianCents < next) {
          tenantMedianBucketIndex = i;
          break;
        }
      }
    }

    return {
      buckets: labels.map((label, index) => ({ label, count: counts[index] ?? 0 })),
      tenantMedianCents,
      tenantMedianBucketIndex,
    };
  },

  async getSignupCohorts(
    tx: TenantTx,
    membershipIds: string[],
  ): Promise<Array<{ label: string; count: number }>> {
    if (membershipIds.length === 0) return [];
    const rows = await tx.$queryRawUnsafe<Array<{ label: string; count: bigint }>>(
      `
      select
        to_char(date_trunc('quarter', coalesce(m.joined_at, m.created_at)), 'YYYY-"Q"Q') as label,
        count(*)::bigint as count
      from memberships m
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.id = any($1::uuid[])
      group by date_trunc('quarter', coalesce(m.joined_at, m.created_at))
      order by date_trunc('quarter', coalesce(m.joined_at, m.created_at)) asc
      limit 8
      `,
      membershipIds,
    );
    return rows.map((row) => {
      const raw = String(row.label); // e.g. 2023-Q2
      const match = /^(\d{4})-Q(\d)$/.exec(raw);
      const label = match ? `Q${match[2]} '${match[1]!.slice(2)}` : raw;
      return { label, count: Number(row.count) };
    });
  },
  async getFieldDistributions(
    tx: TenantTx,
    membershipIds: string[],
  ): Promise<
    Array<{
      field_key: string;
      field_label: string;
      field_type: string;
      value: string;
      segment_count: number;
      tenant_count: number;
    }>
  > {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        field_key: string;
        field_label: string;
        field_type: string;
        value: string;
        segment_count: bigint;
        tenant_count: bigint;
      }>
    >(
      `
      with defs as (
        select id, key, label, field_type
        from custom_field_definitions
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and status = 'ACTIVE'
          and field_type in ('select', 'boolean')
      ),
      filled as (
        select
          cfd.key as field_key,
          cfd.label as field_label,
          cfd.field_type,
          btrim(cfv.value_json #>> '{}') as value,
          cfv.membership_id
        from custom_field_values cfv
        join defs cfd on cfd.id = cfv.custom_field_definition_id
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.value_json is not null
          and cfv.value_json::text not in ('null', '""', '[]', '{}')
          and btrim(cfv.value_json::text, '"') <> ''
      )
      select
        field_key,
        field_label,
        field_type,
        value,
        count(*) filter (where membership_id = any($1::uuid[]))::bigint as segment_count,
        count(*)::bigint as tenant_count
      from filled
      group by field_key, field_label, field_type, value
      order by field_key asc, tenant_count desc
      `,
      membershipIds.length > 0 ? membershipIds : ["00000000-0000-0000-0000-000000000000"],
    );
    return rows.map((row) => ({
      field_key: String(row.field_key),
      field_label: String(row.field_label),
      field_type: String(row.field_type),
      value: String(row.value),
      segment_count: Number(row.segment_count),
      tenant_count: Number(row.tenant_count),
    }));
  },

  async listMatchingLearnersPage(
    tx: TenantTx,
    tree: SegmentConditionsTree,
    fieldTypes: FieldTypeLookup,
    args: { q?: string; page: number; limit: number },
  ): Promise<{
    total: number;
    rows: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      status: string;
      enrollment_count: number;
      total_spent_cents: number;
      currency: string;
      last_active_at: Date | null;
      signed_up_at: Date | null;
    }>;
  }> {
    const predicate = buildConditionsPredicate(tree, fieldTypes);
    if (!predicate) return { total: 0, rows: [] };

    const qParamIndex = predicate.params.length + 1;
    const limitIndex = predicate.params.length + 2;
    const offsetIndex = predicate.params.length + 3;
    const q = args.q ?? null;
    const offset = (args.page - 1) * args.limit;

    const countRows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `
      select count(*)::bigint as count
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${predicate.sql})
        and (
          $${qParamIndex}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower($${qParamIndex}) || '%'
        )
      `,
      ...predicate.params,
      q,
    );

    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      select
        m.id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        m.status::text as status,
        (
          select count(*)::int from enrollments e
          where e.membership_id = m.id and e.tenant_id = m.tenant_id
        ) as enrollment_count,
        coalesce((
          select sum(po.amount_cents)::int from payment_orders po
          where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
        ), 0) as total_spent_cents,
        coalesce((
          select po.currency from payment_orders po
          where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          order by po.paid_at desc nulls last
          limit 1
        ), 'INR') as currency,
        m.last_active_at,
        coalesce(m.joined_at, m.created_at) as signed_up_at
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${predicate.sql})
        and (
          $${qParamIndex}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower($${qParamIndex}) || '%'
        )
      order by coalesce(mp.display_name, ap.email, m.invited_email_normalized) asc nulls last
      limit $${limitIndex}::int
      offset $${offsetIndex}::int
      `,
      ...predicate.params,
      q,
      args.limit,
      offset,
    );

    return {
      total: Number(countRows[0]?.count ?? 0),
      rows: rows.map((row) => ({
        membership_id: String(row["membership_id"]),
        learner_name: row["learner_name"] == null ? null : String(row["learner_name"]),
        email: row["email"] == null ? null : String(row["email"]),
        status: String(row["status"]),
        enrollment_count: Number(row["enrollment_count"] ?? 0),
        total_spent_cents: Number(row["total_spent_cents"] ?? 0),
        currency: String(row["currency"] ?? "INR"),
        last_active_at: (row["last_active_at"] as Date | null) ?? null,
        signed_up_at: (row["signed_up_at"] as Date | null) ?? null,
      })),
    };
  },
};
