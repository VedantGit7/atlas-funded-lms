import type { TenantTx } from "@atlas/db";
import type { CustomFieldRosterQuery } from "./custom-field-roster.dto";
import { textColumn } from "./raw-column";
import type {
  CustomFieldDefRow,
  CustomFieldLearnerRow,
  CustomFieldLearnerValueRow,
  CustomFieldRosterFilter,
} from "./custom-field-roster.repository";

/**
 * The learners roster with custom field values, and field coverage.
 * Part of customFieldRosterRepository.
 */
export const customFieldRosterLearnersRepository = {
  async listFieldDefinitions(tx: TenantTx): Promise<CustomFieldDefRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id::text as id, key, label, field_type
      from custom_field_definitions
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and status = 'ACTIVE'
      order by key asc
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      key: textColumn(row["key"]),
      label: textColumn(row["label"]),
      field_type: textColumn(row["field_type"]),
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
      membership_id: textColumn(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      status: textColumn(row["status"]),
      enrollment_count: Number(row["enrollment_count"] ?? 0),
      total_spent_cents: Number(row["total_spent_cents"] ?? 0),
      currency: textColumn(row["currency"], "INR"),
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
      membership_id: textColumn(row["membership_id"]),
      field_key: textColumn(row["field_key"]),
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
      average_coverage_pct: row?.average_coverage_pct == null ? null : row.average_coverage_pct,
      learners_with_all_fields_filled: Number(row?.learners_with_all_fields_filled ?? 0),
      fields_below_40_coverage: Number(row?.fields_below_40_coverage ?? 0),
    };
  },
};
