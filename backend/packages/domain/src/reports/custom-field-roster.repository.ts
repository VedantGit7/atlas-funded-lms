import type { TenantTx } from "@atlas/db";
import type { CustomFieldRosterQuery } from "./custom-field-roster.dto";

export type CustomFieldDefRow = {
  id: string;
  key: string;
  label: string;
  field_type: string;
};

export type CustomFieldLearnerRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  enrollment_count: number;
  total_spent_cents: number;
  currency: string;
  last_active_at: Date | null;
  signed_up_at: Date | null;
};

export type CustomFieldLearnerValueRow = {
  membership_id: string;
  field_key: string;
  value_json: unknown;
};

export type CustomFieldRosterFilter = {
  q?: string;
  email?: string;
  status?: string;
  signedUpFrom?: string;
  signedUpTo?: string;
  minTotalSpentCents?: number;
  maxTotalSpentCents?: number;
};

export const customFieldRosterRepository = {
  async listFieldDefinitions(tx: TenantTx): Promise<CustomFieldDefRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id::text as id, key, label, field_type
      from custom_field_definitions
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = 'ACTIVE'
      order by key asc
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
    }));
  },

  async countLearners(tx: TenantTx, filter: CustomFieldRosterFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.status ?? null}::text is null or m.status::text = ${filter.status ?? null})
        and (
          ${filter.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and (
          ${filter.signedUpFrom ?? null}::timestamptz is null
          or coalesce(m.joined_at, m.created_at) >= ${filter.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${filter.signedUpTo ?? null}::timestamptz is null
          or coalesce(m.joined_at, m.created_at) <= ${filter.signedUpTo ?? null}::timestamptz
        )
        and (
          ${filter.minTotalSpentCents ?? null}::int is null
          or coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) >= ${filter.minTotalSpentCents ?? null}::int
        )
        and (
          ${filter.maxTotalSpentCents ?? null}::int is null
          or coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) <= ${filter.maxTotalSpentCents ?? null}::int
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listLearners(
    tx: TenantTx,
    query: CustomFieldRosterQuery,
  ): Promise<CustomFieldLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
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
        and (${query.status ?? null}::text is null or m.status::text = ${query.status ?? null})
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.email ?? null}) || '%'
        )
        and (
          ${query.signedUpFrom ?? null}::timestamptz is null
          or coalesce(m.joined_at, m.created_at) >= ${query.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${query.signedUpTo ?? null}::timestamptz is null
          or coalesce(m.joined_at, m.created_at) <= ${query.signedUpTo ?? null}::timestamptz
        )
        and (
          ${query.minTotalSpentCents ?? null}::int is null
          or coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) >= ${query.minTotalSpentCents ?? null}::int
        )
        and (
          ${query.maxTotalSpentCents ?? null}::int is null
          or coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) <= ${query.maxTotalSpentCents ?? null}::int
        )
      order by
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc'
          then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc'
          then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end desc nulls last,
        case when ${query.sortBy} = 'last_active_at' and ${query.sortDir} = 'asc'
          then m.last_active_at end asc nulls last,
        case when ${query.sortBy} = 'last_active_at' and ${query.sortDir} = 'desc'
          then m.last_active_at end desc nulls last,
        case when ${query.sortBy} = 'total_spent_cents' and ${query.sortDir} = 'asc'
          then coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) end asc,
        case when ${query.sortBy} = 'total_spent_cents' and ${query.sortDir} = 'desc'
          then coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) end desc,
        case when ${query.sortBy} = 'signed_up_at' and ${query.sortDir} = 'asc'
          then coalesce(m.joined_at, m.created_at) end asc nulls last,
        case when ${query.sortBy} = 'signed_up_at' and ${query.sortDir} = 'desc'
          then coalesce(m.joined_at, m.created_at) end desc nulls last,
        m.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      status: String(row["status"]),
      enrollment_count: Number(row["enrollment_count"] ?? 0),
      total_spent_cents: Number(row["total_spent_cents"] ?? 0),
      currency: String(row["currency"] ?? "INR"),
      last_active_at: row["last_active_at"] instanceof Date ? row["last_active_at"] : null,
      signed_up_at: row["signed_up_at"] instanceof Date ? row["signed_up_at"] : null,
    }));
  },

  async listMembershipIds(tx: TenantTx, filter: CustomFieldRosterFilter): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select m.id::text as membership_id
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.status ?? null}::text is null or m.status::text = ${filter.status ?? null})
        and (
          ${filter.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.q ?? null}) || '%'
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and (
          ${filter.signedUpFrom ?? null}::timestamptz is null
          or coalesce(m.joined_at, m.created_at) >= ${filter.signedUpFrom ?? null}::timestamptz
        )
        and (
          ${filter.signedUpTo ?? null}::timestamptz is null
          or coalesce(m.joined_at, m.created_at) <= ${filter.signedUpTo ?? null}::timestamptz
        )
        and (
          ${filter.minTotalSpentCents ?? null}::int is null
          or coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) >= ${filter.minTotalSpentCents ?? null}::int
        )
        and (
          ${filter.maxTotalSpentCents ?? null}::int is null
          or coalesce((
            select sum(po.amount_cents)::int from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) <= ${filter.maxTotalSpentCents ?? null}::int
        )
      order by coalesce(m.joined_at, m.created_at) desc
      limit 2000
    `;
    return rows.map((row) => row.membership_id);
  },

  async listValuesForMemberships(
    tx: TenantTx,
    membershipIds: string[],
  ): Promise<CustomFieldLearnerValueRow[]> {
    if (membershipIds.length === 0) return [];
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      select
        cfv.membership_id::text as membership_id,
        cfd.key as field_key,
        cfv.value_json
      from custom_field_values cfv
      join custom_field_definitions cfd
        on cfd.id = cfv.custom_field_definition_id
       and cfd.tenant_id = cfv.tenant_id
      where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
        and cfv.membership_id = any($1::uuid[])
        and cfd.status = 'ACTIVE'
      `,
      membershipIds,
    );
    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      field_key: String(row["field_key"]),
      value_json: row["value_json"],
    }));
  },

  async getCoverageSummary(
    tx: TenantTx,
    filter: CustomFieldRosterFilter,
  ): Promise<{
    learner_count: number;
    active_learner_count: number;
    inactive_learner_count: number;
    custom_field_count: number;
    average_coverage_pct: number | null;
    learners_with_all_fields_filled: number;
    fields_below_40_coverage: number;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        learner_count: bigint;
        active_learner_count: bigint;
        inactive_learner_count: bigint;
        custom_field_count: bigint;
        average_coverage_pct: number | null;
        learners_with_all_fields_filled: bigint;
        fields_below_40_coverage: bigint;
      }>
    >`
      with learners as (
        select m.id, m.status::text as status
        from memberships m
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${filter.status ?? null}::text is null or m.status::text = ${filter.status ?? null})
          and (
            ${filter.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
          )
          and (
            ${filter.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.email ?? null}) || '%'
          )
          and (
            ${filter.signedUpFrom ?? null}::timestamptz is null
            or coalesce(m.joined_at, m.created_at) >= ${filter.signedUpFrom ?? null}::timestamptz
          )
          and (
            ${filter.signedUpTo ?? null}::timestamptz is null
            or coalesce(m.joined_at, m.created_at) <= ${filter.signedUpTo ?? null}::timestamptz
          )
          and (
            ${filter.minTotalSpentCents ?? null}::int is null
            or coalesce((
              select sum(po.amount_cents)::int from payment_orders po
              where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
            ), 0) >= ${filter.minTotalSpentCents ?? null}::int
          )
          and (
            ${filter.maxTotalSpentCents ?? null}::int is null
            or coalesce((
              select sum(po.amount_cents)::int from payment_orders po
              where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
            ), 0) <= ${filter.maxTotalSpentCents ?? null}::int
          )
      ),
      defs as (
        select id
        from custom_field_definitions
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and status = 'ACTIVE'
      ),
      learner_totals as (
        select
          count(*)::bigint as learner_count,
          count(*) filter (where status = 'ACTIVE')::bigint as active_learner_count,
          count(*) filter (where status <> 'ACTIVE')::bigint as inactive_learner_count
        from learners
      ),
      per_field as (
        select
          d.id as definition_id,
          (select learner_count from learner_totals) as total_learners,
          (
            select count(distinct cfv.membership_id)::bigint
            from custom_field_values cfv
            where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
              and cfv.custom_field_definition_id = d.id
              and cfv.membership_id in (select id from learners)
              and cfv.value_json is not null
              and cfv.value_json::text not in ('null', '""', '[]', '{}')
              and btrim(cfv.value_json::text, '"') <> ''
          ) as filled_learners
        from defs d
      ),
      coverage as (
        select
          case
            when (select count(*) from defs) = 0 then null
            when (select learner_count from learner_totals) = 0 then 0::float8
            else (
              select avg(
                case
                  when total_learners = 0 then 0::float8
                  else (filled_learners::float8 / total_learners::float8) * 100.0
                end
              )
              from per_field
            )
          end as average_coverage_pct,
          (
            select count(*)::bigint
            from per_field
            where total_learners > 0
              and (filled_learners::float8 / total_learners::float8) < 0.4
          ) as fields_below_40_coverage,
          case
            when (select count(*) from defs) = 0 then 0::bigint
            else (
              select count(*)::bigint
              from learners l
              where (
                select count(*)::bigint
                from defs d
                where exists (
                  select 1
                  from custom_field_values cfv
                  where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
                    and cfv.custom_field_definition_id = d.id
                    and cfv.membership_id = l.id
                    and cfv.value_json is not null
                    and cfv.value_json::text not in ('null', '""', '[]', '{}')
                    and btrim(cfv.value_json::text, '"') <> ''
                )
              ) = (select count(*) from defs)
            )
          end as learners_with_all_fields_filled
      )
      select
        lt.learner_count,
        lt.active_learner_count,
        lt.inactive_learner_count,
        (select count(*)::bigint from defs) as custom_field_count,
        c.average_coverage_pct,
        c.learners_with_all_fields_filled,
        c.fields_below_40_coverage
      from learner_totals lt
      cross join coverage c
    `;

    const row = rows[0];
    return {
      learner_count: Number(row?.learner_count ?? 0),
      active_learner_count: Number(row?.active_learner_count ?? 0),
      inactive_learner_count: Number(row?.inactive_learner_count ?? 0),
      custom_field_count: Number(row?.custom_field_count ?? 0),
      average_coverage_pct:
        row?.average_coverage_pct == null ? null : Number(row.average_coverage_pct),
      learners_with_all_fields_filled: Number(row?.learners_with_all_fields_filled ?? 0),
      fields_below_40_coverage: Number(row?.fields_below_40_coverage ?? 0),
    };
  },

  async listFieldCatalogue(tx: TenantTx): Promise<
    Array<{
      id: string;
      key: string;
      label: string;
      field_type: string;
      status: string;
      options_json: unknown;
      created_at: Date;
      learner_count: number;
      filled_count: number;
      distinct_value_count: number;
      last_updated_at: Date | null;
      most_common_value_json: unknown;
      most_common_count: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with learners as (
        select m.id
        from memberships m
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      learner_count as (
        select count(*)::bigint as n from learners
      ),
      defs as (
        select
          id,
          key,
          label,
          field_type,
          status::text as status,
          options_json,
          created_at
        from custom_field_definitions
        where tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      filled as (
        select
          cfv.custom_field_definition_id as definition_id,
          cfv.membership_id,
          cfv.value_json,
          cfv.updated_at
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.membership_id in (select id from learners)
          and cfv.value_json is not null
          and cfv.value_json::text not in ('null', '""', '[]', '{}')
          and btrim(cfv.value_json::text, '"') <> ''
      ),
      per_field as (
        select
          d.id,
          d.key,
          d.label,
          d.field_type,
          d.status,
          d.options_json,
          d.created_at,
          (select n from learner_count) as learner_count,
          count(distinct f.membership_id)::bigint as filled_count,
          count(distinct f.value_json::text)::bigint as distinct_value_count,
          max(f.updated_at) as last_updated_at
        from defs d
        left join filled f on f.definition_id = d.id
        group by d.id, d.key, d.label, d.field_type, d.status, d.options_json, d.created_at
      ),
      value_counts as (
        select
          definition_id,
          value_json,
          count(*)::bigint as cnt,
          row_number() over (
            partition by definition_id
            order by count(*) desc, value_json::text asc
          ) as rn
        from filled
        group by definition_id, value_json
      )
      select
        p.id::text as id,
        p.key,
        p.label,
        p.field_type,
        p.status,
        p.options_json,
        p.created_at,
        p.learner_count,
        p.filled_count,
        p.distinct_value_count,
        p.last_updated_at,
        vc.value_json as most_common_value_json,
        coalesce(vc.cnt, 0)::bigint as most_common_count
      from per_field p
      left join value_counts vc on vc.definition_id = p.id and vc.rn = 1
    `;

    return rows.map((row) => ({
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      options_json: row["options_json"],
      created_at: row["created_at"] instanceof Date ? row["created_at"] : new Date(String(row["created_at"])),
      learner_count: Number(row["learner_count"] ?? 0),
      filled_count: Number(row["filled_count"] ?? 0),
      distinct_value_count: Number(row["distinct_value_count"] ?? 0),
      last_updated_at:
        row["last_updated_at"] instanceof Date
          ? row["last_updated_at"]
          : row["last_updated_at"]
            ? new Date(String(row["last_updated_at"]))
            : null,
      most_common_value_json: row["most_common_value_json"] ?? null,
      most_common_count: Number(row["most_common_count"] ?? 0),
    }));
  },

  async getFieldDefinitionByKey(
    tx: TenantTx,
    fieldKey: string,
  ): Promise<{
    id: string;
    key: string;
    label: string;
    field_type: string;
    status: string;
    options_json: unknown;
    created_at: Date;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id::text as id,
        key,
        label,
        field_type,
        status::text as status,
        options_json,
        created_at
      from custom_field_definitions
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and key = ${fieldKey}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      options_json: row["options_json"],
      created_at:
        row["created_at"] instanceof Date
          ? row["created_at"]
          : new Date(String(row["created_at"])),
    };
  },

  async getFieldDetailSummary(
    tx: TenantTx,
    definitionId: string,
  ): Promise<{
    learner_count: number;
    filled_count: number;
    distinct_value_count: number;
    last_updated_at: Date | null;
    most_common_value_json: unknown;
    most_common_count: number;
  }> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with learners as (
        select m.id
        from memberships m
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      filled as (
        select
          cfv.membership_id,
          cfv.value_json,
          cfv.updated_at
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.custom_field_definition_id = ${definitionId}::uuid
          and cfv.membership_id in (select id from learners)
          and cfv.value_json is not null
          and cfv.value_json::text not in ('null', '""', '[]', '{}')
          and btrim(cfv.value_json::text, '"') <> ''
      ),
      value_counts as (
        select
          value_json,
          count(*)::bigint as cnt,
          row_number() over (order by count(*) desc, value_json::text asc) as rn
        from filled
        group by value_json
      )
      select
        (select count(*)::bigint from learners) as learner_count,
        (select count(distinct membership_id)::bigint from filled) as filled_count,
        (select count(distinct value_json::text)::bigint from filled) as distinct_value_count,
        (select max(updated_at) from filled) as last_updated_at,
        (select value_json from value_counts where rn = 1) as most_common_value_json,
        coalesce((select cnt from value_counts where rn = 1), 0)::bigint as most_common_count
    `;
    const row = rows[0];
    return {
      learner_count: Number(row?.["learner_count"] ?? 0),
      filled_count: Number(row?.["filled_count"] ?? 0),
      distinct_value_count: Number(row?.["distinct_value_count"] ?? 0),
      last_updated_at:
        row?.["last_updated_at"] instanceof Date
          ? row["last_updated_at"]
          : row?.["last_updated_at"]
            ? new Date(String(row["last_updated_at"]))
            : null,
      most_common_value_json: row?.["most_common_value_json"] ?? null,
      most_common_count: Number(row?.["most_common_count"] ?? 0),
    };
  },

  async listFieldValueCounts(
    tx: TenantTx,
    definitionId: string,
  ): Promise<Array<{ value_text: string; count: number }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with learners as (
        select m.id
        from memberships m
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      filled as (
        select
          case
            when jsonb_typeof(cfv.value_json) = 'string' then cfv.value_json #>> '{}'
            when jsonb_typeof(cfv.value_json) = 'boolean' then cfv.value_json::text
            when jsonb_typeof(cfv.value_json) = 'number' then cfv.value_json #>> '{}'
            else btrim(cfv.value_json::text, '"')
          end as value_text
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.custom_field_definition_id = ${definitionId}::uuid
          and cfv.membership_id in (select id from learners)
          and cfv.value_json is not null
          and cfv.value_json::text not in ('null', '""', '[]', '{}')
          and btrim(cfv.value_json::text, '"') <> ''
      )
      select value_text, count(*)::bigint as count
      from filled
      where value_text is not null and value_text <> ''
      group by value_text
      order by count desc, value_text asc
    `;
    return rows.map((row) => ({
      value_text: String(row["value_text"] ?? ""),
      count: Number(row["count"] ?? 0),
    }));
  },

  async listNumericFieldValues(
    tx: TenantTx,
    definitionId: string,
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      num_value: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with learners as (
        select
          m.id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email
        from memberships m
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      nums as (
        select
          cfv.membership_id,
          case
            when jsonb_typeof(cfv.value_json) = 'number' then (cfv.value_json #>> '{}')::double precision
            when jsonb_typeof(cfv.value_json) = 'string'
              and (cfv.value_json #>> '{}') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              then (cfv.value_json #>> '{}')::double precision
            else null
          end as num_value
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.custom_field_definition_id = ${definitionId}::uuid
          and cfv.membership_id in (select id from learners)
      )
      select
        n.membership_id::text as membership_id,
        l.learner_name,
        l.email,
        n.num_value
      from nums n
      join learners l on l.id = n.membership_id
      where n.num_value is not null
    `;
    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : String(row["learner_name"]),
      email: row["email"] == null ? null : String(row["email"]),
      num_value: Number(row["num_value"]),
    }));
  },

  async listBooleanWeeklyTrend(
    tx: TenantTx,
    definitionId: string,
  ): Promise<
    Array<{
      week_start: Date;
      yes_count: number;
      no_count: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with learners as (
        select m.id
        from memberships m
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      weeks as (
        select date_trunc('week', d)::timestamptz as week_start
        from generate_series(
          date_trunc('week', now() - interval '11 weeks'),
          date_trunc('week', now()),
          interval '1 week'
        ) as d
      ),
      filled as (
        select
          date_trunc('week', cfv.updated_at) as week_start,
          case
            when jsonb_typeof(cfv.value_json) = 'boolean' and (cfv.value_json #>> '{}') = 'true' then 'yes'
            when jsonb_typeof(cfv.value_json) = 'boolean' and (cfv.value_json #>> '{}') = 'false' then 'no'
            when lower(cfv.value_json #>> '{}') in ('true', 'yes', '1') then 'yes'
            when lower(cfv.value_json #>> '{}') in ('false', 'no', '0') then 'no'
            else null
          end as yn
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.custom_field_definition_id = ${definitionId}::uuid
          and cfv.membership_id in (select id from learners)
          and cfv.updated_at >= date_trunc('week', now() - interval '11 weeks')
      )
      select
        w.week_start,
        coalesce(sum(case when f.yn = 'yes' then 1 else 0 end), 0)::bigint as yes_count,
        coalesce(sum(case when f.yn = 'no' then 1 else 0 end), 0)::bigint as no_count
      from weeks w
      left join filled f on f.week_start = w.week_start
      group by w.week_start
      order by w.week_start asc
    `;
    return rows.map((row) => ({
      week_start:
        row["week_start"] instanceof Date
          ? row["week_start"]
          : new Date(String(row["week_start"])),
      yes_count: Number(row["yes_count"] ?? 0),
      no_count: Number(row["no_count"] ?? 0),
    }));
  },

  async listCrossTabCounts(
    tx: TenantTx,
    definitionId: string,
    otherDefinitionId: string,
  ): Promise<Array<{ row_value: string; col_value: string; count: number }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with learners as (
        select m.id
        from memberships m
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      a as (
        select
          cfv.membership_id,
          case
            when jsonb_typeof(cfv.value_json) = 'string' then cfv.value_json #>> '{}'
            when jsonb_typeof(cfv.value_json) = 'boolean' then cfv.value_json::text
            when jsonb_typeof(cfv.value_json) = 'number' then cfv.value_json #>> '{}'
            else btrim(cfv.value_json::text, '"')
          end as value_text
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.custom_field_definition_id = ${definitionId}::uuid
          and cfv.membership_id in (select id from learners)
          and cfv.value_json is not null
          and cfv.value_json::text not in ('null', '""', '[]', '{}')
          and btrim(cfv.value_json::text, '"') <> ''
      ),
      b as (
        select
          cfv.membership_id,
          case
            when jsonb_typeof(cfv.value_json) = 'string' then cfv.value_json #>> '{}'
            when jsonb_typeof(cfv.value_json) = 'boolean' then cfv.value_json::text
            when jsonb_typeof(cfv.value_json) = 'number' then cfv.value_json #>> '{}'
            else btrim(cfv.value_json::text, '"')
          end as value_text
        from custom_field_values cfv
        where cfv.tenant_id = current_setting('app.tenant_id', true)::uuid
          and cfv.custom_field_definition_id = ${otherDefinitionId}::uuid
          and cfv.membership_id in (select id from learners)
          and cfv.value_json is not null
          and cfv.value_json::text not in ('null', '""', '[]', '{}')
          and btrim(cfv.value_json::text, '"') <> ''
      )
      select
        a.value_text as row_value,
        b.value_text as col_value,
        count(*)::bigint as count
      from a
      join b on b.membership_id = a.membership_id
      where a.value_text is not null and a.value_text <> ''
        and b.value_text is not null and b.value_text <> ''
      group by a.value_text, b.value_text
    `;
    return rows.map((row) => ({
      row_value: String(row["row_value"] ?? ""),
      col_value: String(row["col_value"] ?? ""),
      count: Number(row["count"] ?? 0),
    }));
  },

  async countFieldDetailLearners(
    tx: TenantTx,
    args: {
      definitionId: string;
      q?: string;
      valueFilter?: string;
      minValue?: number;
      maxValue?: number;
    },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with base as (
        select
          m.id as membership_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized, '') as learner_name,
          coalesce(ap.email, m.invited_email_normalized, '') as email,
          case
            when cfv.id is null then null
            when jsonb_typeof(cfv.value_json) = 'string' then cfv.value_json #>> '{}'
            when jsonb_typeof(cfv.value_json) = 'boolean' then cfv.value_json::text
            when jsonb_typeof(cfv.value_json) = 'number' then cfv.value_json #>> '{}'
            when cfv.value_json is null then null
            when cfv.value_json::text in ('null', '""', '[]', '{}') then null
            when btrim(cfv.value_json::text, '"') = '' then null
            else btrim(cfv.value_json::text, '"')
          end as field_value,
          case
            when cfv.id is null then null
            when jsonb_typeof(cfv.value_json) = 'number' then (cfv.value_json #>> '{}')::double precision
            when jsonb_typeof(cfv.value_json) = 'string'
              and (cfv.value_json #>> '{}') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              then (cfv.value_json #>> '{}')::double precision
            else null
          end as num_value
        from memberships m
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        left join custom_field_values cfv
          on cfv.membership_id = m.id
          and cfv.tenant_id = m.tenant_id
          and cfv.custom_field_definition_id = ${args.definitionId}::uuid
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      )
      select count(*)::bigint as count
      from base
      where (
          ${args.q ?? null}::text is null
          or lower(learner_name) like '%' || lower(${args.q ?? null}) || '%'
          or lower(email) like '%' || lower(${args.q ?? null}) || '%'
        )
        and (
          ${args.valueFilter ?? null}::text is null
          or (
            ${args.valueFilter ?? null} = 'missing'
            and field_value is null
          )
          or (
            ${args.valueFilter ?? null} <> 'missing'
            and field_value = ${args.valueFilter ?? null}
          )
        )
        and (
          ${args.minValue ?? null}::double precision is null
          or num_value >= ${args.minValue ?? null}::double precision
        )
        and (
          ${args.maxValue ?? null}::double precision is null
          or num_value <= ${args.maxValue ?? null}::double precision
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listFieldDetailLearners(
    tx: TenantTx,
    args: {
      definitionId: string;
      q?: string;
      valueFilter?: string;
      minValue?: number;
      maxValue?: number;
      limit: number;
      offset: number;
    },
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      status: string;
      enrollment_count: number;
      total_spent_cents: number;
      currency: string;
      last_active_at: Date | null;
      signed_up_at: Date | null;
      field_value: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with base as (
        select
          m.id as membership_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          m.status::text as status,
          (
            select count(*)::bigint from enrollments e
            where e.membership_id = m.id and e.tenant_id = m.tenant_id
          ) as enrollment_count,
          coalesce((
            select sum(po.amount_cents)::bigint from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
          ), 0) as total_spent_cents,
          coalesce((
            select po.currency from payment_orders po
            where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
            order by po.paid_at desc nulls last
            limit 1
          ), 'INR') as currency,
          m.last_active_at,
          coalesce(m.joined_at, m.created_at) as signed_up_at,
          case
            when cfv.id is null then null
            when jsonb_typeof(cfv.value_json) = 'string' then cfv.value_json #>> '{}'
            when jsonb_typeof(cfv.value_json) = 'boolean' then cfv.value_json::text
            when jsonb_typeof(cfv.value_json) = 'number' then cfv.value_json #>> '{}'
            when cfv.value_json is null then null
            when cfv.value_json::text in ('null', '""', '[]', '{}') then null
            when btrim(cfv.value_json::text, '"') = '' then null
            else btrim(cfv.value_json::text, '"')
          end as field_value,
          case
            when cfv.id is null then null
            when jsonb_typeof(cfv.value_json) = 'number' then (cfv.value_json #>> '{}')::double precision
            when jsonb_typeof(cfv.value_json) = 'string'
              and (cfv.value_json #>> '{}') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              then (cfv.value_json #>> '{}')::double precision
            else null
          end as num_value
        from memberships m
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        left join custom_field_values cfv
          on cfv.membership_id = m.id
          and cfv.tenant_id = m.tenant_id
          and cfv.custom_field_definition_id = ${args.definitionId}::uuid
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      )
      select
        membership_id::text as membership_id,
        learner_name,
        email,
        status,
        enrollment_count,
        total_spent_cents,
        currency,
        last_active_at,
        signed_up_at,
        field_value
      from base
      where (
          ${args.q ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${args.q ?? null}) || '%'
          or lower(coalesce(email, '')) like '%' || lower(${args.q ?? null}) || '%'
        )
        and (
          ${args.valueFilter ?? null}::text is null
          or (
            ${args.valueFilter ?? null} = 'missing'
            and field_value is null
          )
          or (
            ${args.valueFilter ?? null} <> 'missing'
            and field_value = ${args.valueFilter ?? null}
          )
        )
        and (
          ${args.minValue ?? null}::double precision is null
          or num_value >= ${args.minValue ?? null}::double precision
        )
        and (
          ${args.maxValue ?? null}::double precision is null
          or num_value <= ${args.maxValue ?? null}::double precision
        )
      order by coalesce(learner_name, email, '') asc
      limit ${args.limit} offset ${args.offset}
    `;

    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : String(row["learner_name"]),
      email: row["email"] == null ? null : String(row["email"]),
      status: String(row["status"] ?? ""),
      enrollment_count: Number(row["enrollment_count"] ?? 0),
      total_spent_cents: Number(row["total_spent_cents"] ?? 0),
      currency: String(row["currency"] ?? "INR"),
      last_active_at:
        row["last_active_at"] instanceof Date
          ? row["last_active_at"]
          : row["last_active_at"]
            ? new Date(String(row["last_active_at"]))
            : null,
      signed_up_at:
        row["signed_up_at"] instanceof Date
          ? row["signed_up_at"]
          : row["signed_up_at"]
            ? new Date(String(row["signed_up_at"]))
            : null,
      field_value: row["field_value"] == null ? null : String(row["field_value"]),
    }));
  },

  async findLearnerSummary(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{
    membership_id: string;
    learner_name: string | null;
    email: string | null;
    status: string;
    avatar_url: string | null;
    enrollment_count: number;
    total_spent_cents: number;
    currency: string;
    last_active_at: Date | null;
    signed_up_at: Date | null;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        m.id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        m.status::text as status,
        mp.avatar_key as avatar_url,
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
        and m.id = ${membershipId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membership_id: String(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : String(row["learner_name"]),
      email: row["email"] == null ? null : String(row["email"]),
      status: String(row["status"] ?? ""),
      avatar_url: row["avatar_url"] == null ? null : String(row["avatar_url"]),
      enrollment_count: Number(row["enrollment_count"] ?? 0),
      total_spent_cents: Number(row["total_spent_cents"] ?? 0),
      currency: String(row["currency"] ?? "INR"),
      last_active_at:
        row["last_active_at"] instanceof Date
          ? row["last_active_at"]
          : row["last_active_at"]
            ? new Date(String(row["last_active_at"]))
            : null,
      signed_up_at:
        row["signed_up_at"] instanceof Date
          ? row["signed_up_at"]
          : row["signed_up_at"]
            ? new Date(String(row["signed_up_at"]))
            : null,
    };
  },

  async listLearnerFieldValues(
    tx: TenantTx,
    membershipId: string,
  ): Promise<
    Array<{
      definition_id: string;
      key: string;
      label: string;
      field_type: string;
      status: string;
      options_json: unknown;
      value_json: unknown | null;
      updated_at: Date | null;
      updated_by_membership_id: string | null;
      updated_by_name: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        d.id::text as definition_id,
        d.key,
        d.label,
        d.field_type,
        d.status::text as status,
        d.options_json,
        cfv.value_json,
        cfv.updated_at,
        cfv.updated_by_membership_id::text as updated_by_membership_id,
        coalesce(ump.display_name, uap.email, um.invited_email_normalized) as updated_by_name
      from custom_field_definitions d
      left join custom_field_values cfv
        on cfv.custom_field_definition_id = d.id
        and cfv.tenant_id = d.tenant_id
        and cfv.membership_id = ${membershipId}::uuid
      left join memberships um
        on um.id = cfv.updated_by_membership_id and um.tenant_id = d.tenant_id
      left join member_profiles ump
        on ump.membership_id = um.id and ump.tenant_id = um.tenant_id and ump.deleted_at is null
      left join auth_principals uap on uap.id = um.auth_principal_id
      where d.tenant_id = current_setting('app.tenant_id', true)::uuid
        and d.status::text in ('ACTIVE', 'INACTIVE', 'ARCHIVED')
      order by d.created_at asc, d.key asc
    `;
    return rows.map((row) => ({
      definition_id: String(row["definition_id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      options_json: row["options_json"],
      value_json: row["value_json"] ?? null,
      updated_at:
        row["updated_at"] instanceof Date
          ? row["updated_at"]
          : row["updated_at"]
            ? new Date(String(row["updated_at"]))
            : null,
      updated_by_membership_id:
        row["updated_by_membership_id"] == null
          ? null
          : String(row["updated_by_membership_id"]),
      updated_by_name:
        row["updated_by_name"] == null ? null : String(row["updated_by_name"]),
    }));
  },

  async listLearnerFieldHistory(
    tx: TenantTx,
    membershipId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      definition_id: string;
      field_key: string;
      field_label: string;
      field_type: string;
      old_value_json: unknown | null;
      new_value_json: unknown | null;
      changed_at: Date;
      changed_by_name: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        h.id::text as id,
        h.custom_field_definition_id::text as definition_id,
        d.key as field_key,
        d.label as field_label,
        d.field_type,
        h.old_value_json,
        h.new_value_json,
        h.changed_at,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as changed_by_name
      from custom_field_value_history h
      join custom_field_definitions d
        on d.id = h.custom_field_definition_id and d.tenant_id = h.tenant_id
      left join memberships m
        on m.id = h.changed_by_membership_id and m.tenant_id = h.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where h.tenant_id = current_setting('app.tenant_id', true)::uuid
        and h.membership_id = ${membershipId}::uuid
      order by h.changed_at desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      definition_id: String(row["definition_id"]),
      field_key: String(row["field_key"]),
      field_label: String(row["field_label"]),
      field_type: String(row["field_type"]),
      old_value_json: row["old_value_json"] ?? null,
      new_value_json: row["new_value_json"] ?? null,
      changed_at:
        row["changed_at"] instanceof Date
          ? row["changed_at"]
          : new Date(String(row["changed_at"])),
      changed_by_name:
        row["changed_by_name"] == null ? null : String(row["changed_by_name"]),
    }));
  },
};
