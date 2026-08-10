import type { TenantTx } from "@atlas/db";
import type { SchedulesRosterListQuery } from "./schedules-roster.dto";

export type ScheduleRosterRow = {
  id: string;
  name: string | null;
  definition_key: string;
  definition_title: string;
  cron_expression: string;
  timezone: string;
  formats_json: unknown;
  delivery_json: unknown;
  is_active: boolean;
  next_run_at: Date;
  created_by_membership_id: string;
  owner_name: string | null;
  created_at: Date;
  updated_at: Date;
  last_run_at: Date | null;
  last_run_status: string | null;
  last_run_row_count: number | null;
  last_run_error_message: string | null;
  past_run_count: number;
  consecutive_failures: number;
};

type Filter = {
  q: string | null;
  definitionKey: string | null;
  status: string;
  cadence: string;
  destination: string;
  ownerMembershipId: string | null;
  sort: string;
  limit: number;
  offset: number;
};

function fromQuery(query: SchedulesRosterListQuery): Filter {
  return {
    q: query.q ?? null,
    definitionKey: query.definitionKey ?? null,
    status: query.status,
    cadence: query.cadence,
    destination: query.destination,
    ownerMembershipId: query.ownerMembershipId ?? null,
    sort: query.sort,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  };
}

/**
 * Classify cron / alias strings into cadence buckets used by the ledger filters.
 */
export function classifyCadence(
  cronExpression: string,
): "hourly" | "daily" | "weekly" | "monthly" | "custom" {
  const n = cronExpression.trim().toLowerCase();
  if (n === "hourly" || n === "0 * * * *") return "hourly";
  if (n === "weekly" || n === "0 0 * * 1") return "weekly";
  if (n === "monthly" || n === "0 0 1 * *") return "monthly";
  if (n === "daily" || n === "0 0 * * *" || n === "0 0 * * 0") return "daily";
  // crude cron pattern checks
  const parts = n.split(/\s+/);
  if (parts.length >= 5) {
    if (parts[1] === "*" && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
      return "hourly";
    }
    if (parts[2] === "*" && parts[3] === "*" && parts[4] === "*") return "daily";
    if (parts[2] === "*" && parts[3] === "*" && parts[4] !== "*") return "weekly";
    if (parts[2] !== "*" && parts[3] === "*") return "monthly";
  }
  return "custom";
}

export function cadenceLabel(cronExpression: string, timezone: string): string {
  const kind = classifyCadence(cronExpression);
  const tz = timezone.trim() || "UTC";
  switch (kind) {
    case "hourly":
      return `Every hour (${tz})`;
    case "daily":
      return `Every day, 00:00 ${tz}`;
    case "weekly":
      return `Every Monday, 00:00 ${tz}`;
    case "monthly":
      return `Day 1 of month, 00:00 ${tz}`;
    case "custom":
      return `${cronExpression} (${tz})`;
  }
}

type DeliveryParsed = {
  kinds: Array<"download" | "email" | "webhook" | "storage">;
  emails: string[];
  webhookHost: string | null;
  storageLabel: string | null;
  isExternal: boolean;
};

export function parseDelivery(deliveryJson: unknown): DeliveryParsed {
  if (!deliveryJson || typeof deliveryJson !== "object" || Array.isArray(deliveryJson)) {
    return {
      kinds: ["download"],
      emails: [],
      webhookHost: null,
      storageLabel: null,
      isExternal: false,
    };
  }
  const delivery = deliveryJson as Record<string, unknown>;
  const emails = Array.isArray(delivery["emails"])
    ? delivery["emails"].filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    : [];
  let webhookHost: string | null = null;
  if (typeof delivery["webhookUrl"] === "string" && delivery["webhookUrl"].trim()) {
    try {
      webhookHost = new URL(delivery["webhookUrl"].trim()).host;
    } catch {
      webhookHost = "webhook";
    }
  }
  const mode = typeof delivery["mode"] === "string" ? delivery["mode"].toLowerCase() : "";
  const storageLabel =
    typeof delivery["bucket"] === "string"
      ? delivery["bucket"]
      : typeof delivery["path"] === "string"
        ? delivery["path"]
        : mode.includes("s3") || mode.includes("sftp") || mode.includes("storage")
          ? mode
          : null;

  const kinds: DeliveryParsed["kinds"] = [];
  if (emails.length > 0) kinds.push("email");
  if (webhookHost) kinds.push("webhook");
  if (storageLabel) kinds.push("storage");
  if (kinds.length === 0) kinds.push("download");

  const isExternal = kinds.some((k) => k === "email" || k === "webhook" || k === "storage");
  return { kinds, emails, webhookHost, storageLabel, isExternal };
}

export const schedulesRosterRepository = {
  async summarize(tx: TenantTx) {
    const rows = await tx.$queryRaw<
      Array<{
        total_count: number;
        enabled_count: number;
        paused_count: number;
        failing_count: number;
        max_consecutive_failures: number;
        external_delivery_count: number;
        next_run_at: Date | null;
        next_schedule_name: string | null;
        runs_this_month: number;
        runs_succeeded_this_month: number;
        runs_failed_this_month: number;
      }>
    >`
      with month_runs as (
        select
          count(*)::int as runs_this_month,
          count(*) filter (where status = 'SUCCEEDED')::int as runs_succeeded_this_month,
          count(*) filter (where status = 'FAILED')::int as runs_failed_this_month
        from report_runs
        where report_schedule_id is not null
          and created_at >= date_trunc('month', now() at time zone 'utc')
      ),
      last_runs as (
        select distinct on (rr.report_schedule_id)
          rr.report_schedule_id,
          rr.status::text as status
        from report_runs rr
        where rr.report_schedule_id is not null
        order by rr.report_schedule_id, coalesce(rr.completed_at, rr.created_at) desc
      ),
      recent_runs as (
        select
          rr.report_schedule_id,
          rr.status::text as status,
          row_number() over (
            partition by rr.report_schedule_id
            order by coalesce(rr.completed_at, rr.created_at) desc
          ) as rn
        from report_runs rr
        where rr.report_schedule_id is not null
      ),
      consecutive as (
        select
          rr.report_schedule_id,
          (
            select count(*)::int
            from recent_runs r
            where r.report_schedule_id = rr.report_schedule_id
              and r.status = 'FAILED'
              and r.rn = 1
          )
          +
          (
            select count(*)::int
            from recent_runs r
            where r.report_schedule_id = rr.report_schedule_id
              and r.status = 'FAILED'
              and r.rn > 1
              and not exists (
                select 1 from recent_runs mid
                where mid.report_schedule_id = r.report_schedule_id
                  and mid.rn < r.rn
                  and mid.status <> 'FAILED'
              )
          ) as consecutive_failures
        from (select distinct report_schedule_id from recent_runs) rr
      ),
      schedule_stats as (
        select
          count(*)::int as total_count,
          count(*) filter (where rs.is_active)::int as enabled_count,
          count(*) filter (where not rs.is_active)::int as paused_count,
          count(*) filter (
            where coalesce(cf.consecutive_failures, 0) >= 1
              and coalesce(lr.status, '') = 'FAILED'
          )::int as failing_count,
          coalesce(max(cf.consecutive_failures), 0)::int as max_consecutive_failures,
          count(*) filter (
            where rs.delivery_json is not null
              and (
                jsonb_typeof(rs.delivery_json->'emails') = 'array'
                  and jsonb_array_length(rs.delivery_json->'emails') > 0
                or coalesce(rs.delivery_json->>'webhookUrl', '') <> ''
                or coalesce(rs.delivery_json->>'mode', '') ~* '(s3|sftp|storage|bucket)'
                or coalesce(rs.delivery_json->>'bucket', '') <> ''
              )
          )::int as external_delivery_count
        from report_schedules rs
        left join last_runs lr on lr.report_schedule_id = rs.id
        left join consecutive cf on cf.report_schedule_id = rs.id
      ),
      next_due as (
        select
          rs.next_run_at,
          coalesce(rs.name, rd.title) as next_schedule_name
        from report_schedules rs
        join report_definitions rd on rd.id = rs.report_definition_id
        where rs.is_active = true
        order by rs.next_run_at asc
        limit 1
      )
      select
        ss.total_count,
        ss.enabled_count,
        ss.paused_count,
        ss.failing_count,
        ss.max_consecutive_failures,
        ss.external_delivery_count,
        nd.next_run_at,
        nd.next_schedule_name,
        mr.runs_this_month,
        mr.runs_succeeded_this_month,
        mr.runs_failed_this_month
      from schedule_stats ss
      cross join month_runs mr
      left join next_due nd on true
    `;

    const row = rows[0];
    return {
      totalCount: row?.total_count ?? 0,
      enabledCount: row?.enabled_count ?? 0,
      pausedCount: row?.paused_count ?? 0,
      failingCount: row?.failing_count ?? 0,
      maxConsecutiveFailures: row?.max_consecutive_failures ?? 0,
      externalDeliveryCount: row?.external_delivery_count ?? 0,
      nextRunAt: row?.next_run_at ?? null,
      nextScheduleName: row?.next_schedule_name ?? null,
      runsThisMonth: row?.runs_this_month ?? 0,
      runsSucceededThisMonth: row?.runs_succeeded_this_month ?? 0,
      runsFailedThisMonth: row?.runs_failed_this_month ?? 0,
    };
  },

  async list(
    tx: TenantTx,
    query: SchedulesRosterListQuery,
  ): Promise<{
    rows: ScheduleRosterRow[];
    totalCount: number;
  }> {
    const filter = fromQuery(query);

    // Fetch a generous window then filter in JS for cadence/destination classification.
    // Schedule counts are expected to stay modest (tens–low hundreds) for tenant admins.
    const rows = await tx.$queryRaw<Array<ScheduleRosterRow>>`
      with last_runs as (
        select distinct on (rr.report_schedule_id)
          rr.report_schedule_id,
          rr.completed_at,
          rr.created_at,
          rr.status::text as status,
          rr.row_count,
          coalesce(rr.error_json->>'message', rr.error_json->>'code') as error_message
        from report_runs rr
        where rr.report_schedule_id is not null
        order by rr.report_schedule_id, coalesce(rr.completed_at, rr.created_at) desc
      ),
      run_counts as (
        select
          rr.report_schedule_id,
          count(*)::int as past_run_count
        from report_runs rr
        where rr.report_schedule_id is not null
        group by rr.report_schedule_id
      ),
      recent_runs as (
        select
          rr.report_schedule_id,
          rr.status::text as status,
          row_number() over (
            partition by rr.report_schedule_id
            order by coalesce(rr.completed_at, rr.created_at) desc
          ) as rn
        from report_runs rr
        where rr.report_schedule_id is not null
      ),
      consecutive as (
        select
          rr.report_schedule_id,
          (
            select count(*)::int
            from recent_runs r
            where r.report_schedule_id = rr.report_schedule_id
              and r.status = 'FAILED'
              and not exists (
                select 1 from recent_runs mid
                where mid.report_schedule_id = r.report_schedule_id
                  and mid.rn < r.rn
                  and mid.status <> 'FAILED'
              )
          ) as consecutive_failures
        from (select distinct report_schedule_id from recent_runs) rr
      )
      select
        rs.id,
        rs.name,
        rd.key as definition_key,
        rd.title as definition_title,
        rs.cron_expression,
        rs.timezone,
        rs.formats_json,
        rs.delivery_json,
        rs.is_active,
        rs.next_run_at,
        rs.created_by_membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as owner_name,
        rs.created_at,
        rs.updated_at,
        coalesce(lr.completed_at, lr.created_at) as last_run_at,
        lr.status as last_run_status,
        lr.row_count as last_run_row_count,
        lr.error_message as last_run_error_message,
        coalesce(rc.past_run_count, 0)::int as past_run_count,
        coalesce(cf.consecutive_failures, 0)::int as consecutive_failures
      from report_schedules rs
      join report_definitions rd on rd.id = rs.report_definition_id
      left join memberships m
        on m.id = rs.created_by_membership_id and m.tenant_id = rs.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join last_runs lr on lr.report_schedule_id = rs.id
      left join run_counts rc on rc.report_schedule_id = rs.id
      left join consecutive cf on cf.report_schedule_id = rs.id
      where (
        ${filter.q}::text is null
        or lower(coalesce(rs.name, '')) like '%' || lower(${filter.q}) || '%'
        or lower(rd.key) like '%' || lower(${filter.q}) || '%'
        or lower(rd.title) like '%' || lower(${filter.q}) || '%'
      )
      and (
        ${filter.definitionKey}::text is null
        or rd.key = ${filter.definitionKey}
      )
      and (
        ${filter.ownerMembershipId}::text is null
        or rs.created_by_membership_id = ${filter.ownerMembershipId}::uuid
      )
      order by rs.next_run_at asc nulls last, coalesce(rs.name, rd.title) asc
    `;

    return { rows, totalCount: rows.length };
  },
};
