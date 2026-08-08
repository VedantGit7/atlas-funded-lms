import type { TenantTx } from "@atlas/db";
import type { ExportsHistoryListQuery } from "./exports-roster.dto";

export type ExportsHistoryRow = {
  source_type: "report_run" | "export_job";
  id: string;
  definition_key: string | null;
  definition_title: string | null;
  status: string;
  format: string | null;
  row_count: number | null;
  requested_by_name: string | null;
  created_at: Date;
  completed_at: Date | null;
  expires_at: Date | null;
  has_file: boolean;
};

type HistoryFilter = {
  sourceType: string | null;
  status: string | null;
  definitionKey: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  q: string | null;
};

function fromQuery(query: ExportsHistoryListQuery): HistoryFilter {
  return {
    sourceType: query.sourceType ?? null,
    status: query.status ?? null,
    definitionKey: query.definitionKey ?? null,
    createdFrom: query.createdFrom ?? null,
    createdTo: query.createdTo ?? null,
    q: query.q ?? null,
  };
}

export const exportsRosterRepository = {
  async summarize(tx: TenantTx, query: ExportsHistoryListQuery) {
    const filter = fromQuery(query);
    const rows = await tx.$queryRaw<
      Array<{
        total_count: number;
        succeeded_count: number;
        failed_count: number;
        pending_count: number;
      }>
    >`
      with history as (
        select
          'report_run'::text as source_type,
          rr.id,
          rr.status::text as status,
          rd.key as definition_key,
          rd.title as definition_title,
          rr.created_at
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        where rr.tenant_id = current_setting('app.tenant_id', true)::uuid
        union all
        select
          'export_job'::text as source_type,
          ej.id,
          ej.status::text as status,
          null::text as definition_key,
          'Data rights export'::text as definition_title,
          ej.created_at
        from export_jobs ej
        where ej.tenant_id = current_setting('app.tenant_id', true)::uuid
      )
      select
        count(*)::int as total_count,
        count(*) filter (where status = 'SUCCEEDED')::int as succeeded_count,
        count(*) filter (where status = 'FAILED')::int as failed_count,
        count(*) filter (where status in ('QUEUED', 'RUNNING'))::int as pending_count
      from history
      where (${filter.sourceType}::text is null or source_type = ${filter.sourceType})
        and (${filter.status}::text is null or status = ${filter.status})
        and (${filter.definitionKey}::text is null or definition_key = ${filter.definitionKey})
        and (
          ${filter.createdFrom}::timestamptz is null
          or created_at >= ${filter.createdFrom}::timestamptz
        )
        and (
          ${filter.createdTo}::timestamptz is null
          or created_at <= ${filter.createdTo}::timestamptz
        )
        and (
          ${filter.q}::text is null
          or lower(coalesce(definition_key, '')) like '%' || lower(${filter.q}) || '%'
          or lower(coalesce(definition_title, '')) like '%' || lower(${filter.q}) || '%'
          or id::text = ${filter.q}
        )
    `;

    const row = rows[0];
    return {
      totalCount: row?.total_count ?? 0,
      succeededCount: row?.succeeded_count ?? 0,
      failedCount: row?.failed_count ?? 0,
      pendingCount: row?.pending_count ?? 0,
    };
  },

  async countHistory(tx: TenantTx, query: ExportsHistoryListQuery): Promise<number> {
    const summary = await this.summarize(tx, query);
    return summary.totalCount;
  },

  async listHistory(
    tx: TenantTx,
    query: ExportsHistoryListQuery,
  ): Promise<ExportsHistoryRow[]> {
    const filter = fromQuery(query);
    const offset = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<
      Array<{
        source_type: "report_run" | "export_job";
        id: string;
        definition_key: string | null;
        definition_title: string | null;
        status: string;
        format: string | null;
        row_count: number | null;
        requested_by_name: string | null;
        created_at: Date;
        completed_at: Date | null;
        expires_at: Date | null;
        has_file: boolean;
      }>
    >`
      with history as (
        select
          'report_run'::text as source_type,
          rr.id,
          rd.key as definition_key,
          rd.title as definition_title,
          rr.status::text as status,
          rr.format::text as format,
          rr.row_count,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as requested_by_name,
          rr.created_at,
          rr.completed_at,
          rr.expires_at,
          (rr.r2_object_key is not null) as has_file
        from report_runs rr
        join report_definitions rd on rd.id = rr.report_definition_id
        left join memberships m on m.id = rr.requested_by_membership_id and m.tenant_id = rr.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where rr.tenant_id = current_setting('app.tenant_id', true)::uuid
        union all
        select
          'export_job'::text as source_type,
          ej.id,
          null::text as definition_key,
          'Data rights export'::text as definition_title,
          ej.status::text as status,
          null::text as format,
          null::int as row_count,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as requested_by_name,
          ej.created_at,
          null::timestamptz as completed_at,
          ej.expires_at,
          (ej.r2_object_key is not null) as has_file
        from export_jobs ej
        left join memberships m on m.id = ej.requested_by_membership_id and m.tenant_id = ej.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where ej.tenant_id = current_setting('app.tenant_id', true)::uuid
      )
      select
        source_type,
        id::text as id,
        definition_key,
        definition_title,
        status,
        format,
        row_count,
        requested_by_name,
        created_at,
        completed_at,
        expires_at,
        has_file
      from history
      where (${filter.sourceType}::text is null or source_type = ${filter.sourceType})
        and (${filter.status}::text is null or status = ${filter.status})
        and (${filter.definitionKey}::text is null or definition_key = ${filter.definitionKey})
        and (
          ${filter.createdFrom}::timestamptz is null
          or created_at >= ${filter.createdFrom}::timestamptz
        )
        and (
          ${filter.createdTo}::timestamptz is null
          or created_at <= ${filter.createdTo}::timestamptz
        )
        and (
          ${filter.q}::text is null
          or lower(coalesce(definition_key, '')) like '%' || lower(${filter.q}) || '%'
          or lower(coalesce(definition_title, '')) like '%' || lower(${filter.q}) || '%'
          or lower(coalesce(requested_by_name, '')) like '%' || lower(${filter.q}) || '%'
          or id::text = ${filter.q}
        )
      order by created_at desc, id desc
      limit ${query.limit} offset ${offset}
    `;

    return rows;
  },
};
