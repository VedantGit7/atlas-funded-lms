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
  progress_percent: number | null;
  error_message: string | null;
};

type HistoryFilter = {
  sourceType: string | null;
  status: string | null;
  definitionKey: string | null;
  format: string | null;
  fileState: string | null;
  mineMembershipId: string | null;
  pendingOnly: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  q: string | null;
};

function fromQuery(
  query: ExportsHistoryListQuery,
  actorMembershipId?: string | null,
): HistoryFilter {
  return {
    sourceType: query.sourceType ?? null,
    status: query.status ?? null,
    definitionKey: query.definitionKey ?? null,
    format: query.format ?? null,
    fileState: query.fileState ?? null,
    mineMembershipId: query.mine === true ? (actorMembershipId ?? null) : null,
    pendingOnly: query.pendingOnly === true ? "true" : null,
    createdFrom: query.createdFrom ?? null,
    createdTo: query.createdTo ?? null,
    q: query.q ?? null,
  };
}

export const exportsRosterRepository = {
  async summarize(tx: TenantTx, query: ExportsHistoryListQuery, actorMembershipId?: string | null) {
    const filter = fromQuery(query, actorMembershipId);
    const rows = await tx.$queryRaw<
      Array<{
        total_count: number;
        succeeded_count: number;
        failed_count: number;
        pending_count: number;
        files_available_count: number;
        expiring_soon_count: number;
        oldest_pending_title: string | null;
      }>
    >`
      with history as (
        select
          'report_run'::text as source_type,
          rr.id,
          rr.status::text as status,
          rd.key as definition_key,
          rd.title as definition_title,
          rr.format::text as format,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as requested_by_name,
          rr.requested_by_membership_id,
          rr.created_at,
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
          ej.status::text as status,
          null::text as definition_key,
          'Data rights export'::text as definition_title,
          null::text as format,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as requested_by_name,
          ej.requested_by_membership_id,
          ej.created_at,
          ej.expires_at,
          (ej.r2_object_key is not null) as has_file
        from export_jobs ej
        left join memberships m on m.id = ej.requested_by_membership_id and m.tenant_id = ej.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where ej.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      filtered as (
        select *
        from history
        where (${filter.sourceType}::text is null or source_type = ${filter.sourceType})
          and (${filter.status}::text is null or status = ${filter.status})
          and (${filter.definitionKey}::text is null or definition_key = ${filter.definitionKey})
          and (
            ${filter.format}::text is null
            or lower(coalesce(format, '')) = lower(${filter.format})
          )
          and (
            ${filter.mineMembershipId}::uuid is null
            or requested_by_membership_id = ${filter.mineMembershipId}::uuid
          )
          and (
            ${filter.pendingOnly}::text is null
            or status in ('QUEUED', 'RUNNING')
          )
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
          and (
            ${filter.fileState}::text is null
            or (
              ${filter.fileState} = 'available'
              and has_file = true
              and (expires_at is null or expires_at > now())
            )
            or (
              ${filter.fileState} = 'removed'
              and has_file = false
              and status = 'SUCCEEDED'
            )
            or (
              ${filter.fileState} = 'expired'
              and has_file = true
              and expires_at is not null
              and expires_at <= now()
            )
            or (
              ${filter.fileState} = 'expiring_soon'
              and has_file = true
              and expires_at is not null
              and expires_at > now()
              and expires_at <= now() + interval '48 hours'
            )
          )
      )
      select
        count(*)::int as total_count,
        count(*) filter (where status = 'SUCCEEDED')::int as succeeded_count,
        count(*) filter (where status = 'FAILED')::int as failed_count,
        count(*) filter (where status in ('QUEUED', 'RUNNING'))::int as pending_count,
        count(*) filter (
          where has_file = true
            and (expires_at is null or expires_at > now())
        )::int as files_available_count,
        count(*) filter (
          where has_file = true
            and expires_at is not null
            and expires_at > now()
            and expires_at <= now() + interval '48 hours'
        )::int as expiring_soon_count,
        (
          select definition_title
          from filtered
          where status in ('QUEUED', 'RUNNING')
          order by created_at asc
          limit 1
        ) as oldest_pending_title
      from filtered
    `;

    const row = rows[0];
    return {
      totalCount: row?.total_count ?? 0,
      succeededCount: row?.succeeded_count ?? 0,
      failedCount: row?.failed_count ?? 0,
      pendingCount: row?.pending_count ?? 0,
      filesAvailableCount: row?.files_available_count ?? 0,
      expiringSoonCount: row?.expiring_soon_count ?? 0,
      oldestPendingTitle: row?.oldest_pending_title ?? null,
    };
  },

  async countHistory(
    tx: TenantTx,
    query: ExportsHistoryListQuery,
    actorMembershipId?: string | null,
  ): Promise<number> {
    const summary = await this.summarize(tx, query, actorMembershipId);
    return summary.totalCount;
  },

  async listHistory(
    tx: TenantTx,
    query: ExportsHistoryListQuery,
    actorMembershipId?: string | null,
  ): Promise<ExportsHistoryRow[]> {
    const filter = fromQuery(query, actorMembershipId);
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
        progress_percent: number | null;
        error_message: string | null;
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
          rr.requested_by_membership_id,
          rr.created_at,
          rr.completed_at,
          rr.expires_at,
          (rr.r2_object_key is not null) as has_file,
          rr.progress_percent,
          nullif(
            coalesce(rr.error_json->>'message', rr.error_json->>'error'),
            ''
          ) as error_message
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
          ej.requested_by_membership_id,
          ej.created_at,
          null::timestamptz as completed_at,
          ej.expires_at,
          (ej.r2_object_key is not null) as has_file,
          null::int as progress_percent,
          nullif(
            coalesce(ej.error_json->>'message', ej.error_json->>'error'),
            ''
          ) as error_message
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
        has_file,
        progress_percent,
        error_message
      from history
      where (${filter.sourceType}::text is null or source_type = ${filter.sourceType})
        and (${filter.status}::text is null or status = ${filter.status})
        and (${filter.definitionKey}::text is null or definition_key = ${filter.definitionKey})
        and (
          ${filter.format}::text is null
          or lower(coalesce(format, '')) = lower(${filter.format})
        )
        and (
          ${filter.mineMembershipId}::uuid is null
          or requested_by_membership_id = ${filter.mineMembershipId}::uuid
        )
        and (
          ${filter.pendingOnly}::text is null
          or status in ('QUEUED', 'RUNNING')
        )
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
        and (
          ${filter.fileState}::text is null
          or (
            ${filter.fileState} = 'available'
            and has_file = true
            and (expires_at is null or expires_at > now())
          )
          or (
            ${filter.fileState} = 'removed'
            and has_file = false
            and status = 'SUCCEEDED'
          )
          or (
            ${filter.fileState} = 'expired'
            and has_file = true
            and expires_at is not null
            and expires_at <= now()
          )
          or (
            ${filter.fileState} = 'expiring_soon'
            and has_file = true
            and expires_at is not null
            and expires_at > now()
            and expires_at <= now() + interval '48 hours'
          )
        )
      order by created_at desc, id desc
      limit ${query.limit} offset ${offset}
    `;

    return rows;
  },
};
