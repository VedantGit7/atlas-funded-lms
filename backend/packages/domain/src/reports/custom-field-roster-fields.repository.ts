import type { TenantTx } from "@atlas/db";
import { textColumn } from "./raw-column";

/**
 * The field catalogue and one field's detail.
 * Part of customFieldRosterRepository.
 */
export const customFieldRosterFieldsRepository = {
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
      id: textColumn(row["id"]),
      key: textColumn(row["key"]),
      label: textColumn(row["label"]),
      field_type: textColumn(row["field_type"]),
      status: textColumn(row["status"]),
      options_json: row["options_json"],
      created_at:
        row["created_at"] instanceof Date
          ? row["created_at"]
          : new Date(textColumn(row["created_at"])),
      learner_count: Number(row["learner_count"] ?? 0),
      filled_count: Number(row["filled_count"] ?? 0),
      distinct_value_count: Number(row["distinct_value_count"] ?? 0),
      last_updated_at:
        row["last_updated_at"] instanceof Date
          ? row["last_updated_at"]
          : row["last_updated_at"]
            ? new Date(textColumn(row["last_updated_at"]))
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
      id: textColumn(row["id"]),
      key: textColumn(row["key"]),
      label: textColumn(row["label"]),
      field_type: textColumn(row["field_type"]),
      status: textColumn(row["status"]),
      options_json: row["options_json"],
      created_at:
        row["created_at"] instanceof Date
          ? row["created_at"]
          : new Date(textColumn(row["created_at"])),
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
            ? new Date(textColumn(row["last_updated_at"]))
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
      value_text: textColumn(row["value_text"], ""),
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
      membership_id: textColumn(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : textColumn(row["learner_name"]),
      email: row["email"] == null ? null : textColumn(row["email"]),
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
          : new Date(textColumn(row["week_start"])),
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
      row_value: textColumn(row["row_value"], ""),
      col_value: textColumn(row["col_value"], ""),
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
      membership_id: textColumn(row["membership_id"]),
      learner_name: row["learner_name"] == null ? null : textColumn(row["learner_name"]),
      email: row["email"] == null ? null : textColumn(row["email"]),
      status: textColumn(row["status"], ""),
      enrollment_count: Number(row["enrollment_count"] ?? 0),
      total_spent_cents: Number(row["total_spent_cents"] ?? 0),
      currency: textColumn(row["currency"], "INR"),
      last_active_at:
        row["last_active_at"] instanceof Date
          ? row["last_active_at"]
          : row["last_active_at"]
            ? new Date(textColumn(row["last_active_at"]))
            : null,
      signed_up_at:
        row["signed_up_at"] instanceof Date
          ? row["signed_up_at"]
          : row["signed_up_at"]
            ? new Date(textColumn(row["signed_up_at"]))
            : null,
      field_value: row["field_value"] == null ? null : textColumn(row["field_value"]),
    }));
  },
};
