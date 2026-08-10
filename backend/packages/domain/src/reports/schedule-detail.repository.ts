import type { TenantTx } from "@atlas/db";

export type ScheduleDetailRunRow = {
  id: string;
  status: string;
  format: string | null;
  row_count: number | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  r2_object_key: string | null;
  params_json: unknown;
  error_json: unknown;
};

export type ScheduleDetailStatsRow = {
  total_runs: number;
  succeeded_runs: number;
  failed_runs: number;
  avg_duration_ms: number | null;
  avg_row_count: number | null;
};

export type ScheduleOwnerRow = {
  owner_name: string | null;
};

export const scheduleDetailRepository = {
  async getOwnerName(tx: TenantTx, membershipId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<ScheduleOwnerRow>>`
      select coalesce(mp.display_name, ap.email, m.invited_email_normalized) as owner_name
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0]?.owner_name ?? null;
  },

  async getStats(tx: TenantTx, scheduleId: string): Promise<ScheduleDetailStatsRow> {
    const rows = await tx.$queryRaw<Array<ScheduleDetailStatsRow>>`
      select
        count(*)::int as total_runs,
        count(*) filter (where status = 'SUCCEEDED')::int as succeeded_runs,
        count(*) filter (where status = 'FAILED')::int as failed_runs,
        round(
          avg(
            case
              when started_at is not null and completed_at is not null
                then extract(epoch from (completed_at - started_at)) * 1000
              else null
            end
          )
        )::int as avg_duration_ms,
        round(avg(row_count) filter (where status = 'SUCCEEDED' and row_count is not null))::int as avg_row_count
      from report_runs
      where report_schedule_id = ${scheduleId}::uuid
    `;
    const row = rows[0];
    return {
      total_runs: row?.total_runs ?? 0,
      succeeded_runs: row?.succeeded_runs ?? 0,
      failed_runs: row?.failed_runs ?? 0,
      avg_duration_ms: row?.avg_duration_ms == null ? null : row.avg_duration_ms,
      avg_row_count: row?.avg_row_count == null ? null : row.avg_row_count,
    };
  },

  async listRecentRowCounts(tx: TenantTx, scheduleId: string, limit = 12): Promise<number[]> {
    const rows = await tx.$queryRaw<Array<{ row_count: number | null }>>`
      select row_count
      from report_runs
      where report_schedule_id = ${scheduleId}::uuid
        and status = 'SUCCEEDED'
        and row_count is not null
      order by coalesce(completed_at, created_at) desc
      limit ${limit}
    `;
    return rows.map((r) => r.row_count ?? 0).reverse();
  },

  async listRuns(
    tx: TenantTx,
    scheduleId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: ScheduleDetailRunRow[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    const [countRows, rows] = await Promise.all([
      tx.$queryRaw<Array<{ total: number }>>`
        select count(*)::int as total
        from report_runs
        where report_schedule_id = ${scheduleId}::uuid
      `,
      tx.$queryRaw<Array<ScheduleDetailRunRow>>`
        select
          id,
          status::text as status,
          format::text as format,
          row_count,
          started_at,
          completed_at,
          created_at,
          r2_object_key,
          params_json,
          error_json
        from report_runs
        where report_schedule_id = ${scheduleId}::uuid
        order by coalesce(completed_at, created_at) desc
        limit ${limit}
        offset ${offset}
      `,
    ]);
    return {
      rows,
      totalCount: countRows[0]?.total ?? 0,
    };
  },

  async getConsecutiveFailureMeta(
    tx: TenantTx,
    scheduleId: string,
  ): Promise<{
    consecutiveFailures: number;
    lastErrorMessage: string | null;
    failingSinceAt: Date | null;
    failingRunId: string | null;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        error_json: unknown;
        at: Date;
        rn: number;
      }>
    >`
      select
        id,
        status::text as status,
        error_json,
        coalesce(completed_at, created_at) as at,
        row_number() over (order by coalesce(completed_at, created_at) desc) as rn
      from report_runs
      where report_schedule_id = ${scheduleId}::uuid
      order by coalesce(completed_at, created_at) desc
      limit 20
    `;

    let consecutiveFailures = 0;
    let lastErrorMessage: string | null = null;
    let failingSinceAt: Date | null = null;
    let failingRunId: string | null = null;

    for (const row of rows) {
      if (row.status !== "FAILED") break;
      consecutiveFailures += 1;
      if (!failingRunId) {
        failingRunId = row.id;
        if (
          row.error_json &&
          typeof row.error_json === "object" &&
          !Array.isArray(row.error_json)
        ) {
          const err = row.error_json as Record<string, unknown>;
          lastErrorMessage =
            (typeof err["message"] === "string" && err["message"]) ||
            (typeof err["code"] === "string" && err["code"]) ||
            null;
        }
      }
      failingSinceAt = row.at;
    }

    return { consecutiveFailures, lastErrorMessage, failingSinceAt, failingRunId };
  },
};
