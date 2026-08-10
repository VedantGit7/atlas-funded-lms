import type { TenantTx } from "@atlas/db";
import type { SuperLiveInsightsTrendsQuery } from "./super-live-insights-trends.dto";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const BAND_LABELS = ["Morning", "Afternoon", "Evening", "Late"] as const;

type RangeFilter = {
  startedFrom: string;
  startedTo: string;
  courseId: string | null;
  batchId: string | null;
};

type PeriodAggRow = {
  period_key: string;
  period_start: Date;
  session_count: number;
  attended_count: number;
  registered_count: number;
  absent_count: number;
  total_count: number;
  avg_rate: number | null;
  avg_duration_seconds: number | null;
};

type SegmentAggRow = {
  period_key: string;
  period_start: Date;
  segment_key: string;
  segment_label: string;
  session_count: number;
  attended_count: number;
  registered_count: number;
  absent_count: number;
  total_count: number;
  avg_rate: number | null;
};

type DayTimeRow = {
  dow: number;
  band: number;
  session_count: number;
  avg_rate: number | null;
};

type RankedRow = {
  id: string;
  title: string;
  session_count: number;
  avg_rate: number | null;
};

type SparkPoint = {
  id: string;
  period_key: string;
  avg_rate: number | null;
};

function truncUnit(
  granularity: SuperLiveInsightsTrendsQuery["granularity"],
): "day" | "week" | "month" {
  return granularity;
}

function formatPeriodLabel(
  start: Date,
  granularity: SuperLiveInsightsTrendsQuery["granularity"],
): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (granularity === "day") {
    return `${start.getUTCDate()} ${months[start.getUTCMonth()] ?? ""}`;
  }
  if (granularity === "month") {
    return `${months[start.getUTCMonth()] ?? ""} ${start.getUTCFullYear()}`;
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${months[start.getUTCMonth()] ?? ""}`;
  }
  return `${start.getUTCDate()} ${months[start.getUTCMonth()] ?? ""}–${end.getUTCDate()} ${months[end.getUTCMonth()] ?? ""}`;
}

function periodEndExclusive(
  start: Date,
  granularity: SuperLiveInsightsTrendsQuery["granularity"],
): Date {
  const end = new Date(start);
  if (granularity === "day") end.setUTCDate(end.getUTCDate() + 1);
  else if (granularity === "week") end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function periodToInclusive(
  start: Date,
  granularity: SuperLiveInsightsTrendsQuery["granularity"],
): Date {
  const end = periodEndExclusive(start, granularity);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

function periodKeyFromDate(
  start: Date,
  granularity: SuperLiveInsightsTrendsQuery["granularity"],
): string {
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
  const d = String(start.getUTCDate()).padStart(2, "0");
  if (granularity === "month") return `${y}-${m}-01`;
  return `${y}-${m}-${d}`;
}

function enumeratePeriods(
  fromIso: string,
  toIso: string,
  granularity: SuperLiveInsightsTrendsQuery["granularity"],
): Array<{ key: string; start: Date }> {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  if (granularity === "week") {
    const day = cursor.getUTCDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? -6 : 1 - day;
    cursor.setUTCDate(cursor.getUTCDate() + diff);
  } else if (granularity === "month") {
    cursor.setUTCDate(1);
  }

  const out: Array<{ key: string; start: Date }> = [];
  while (cursor.getTime() <= to.getTime()) {
    const start = new Date(cursor);
    out.push({ key: periodKeyFromDate(start, granularity), start });
    if (granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (granularity === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (out.length > 400) break;
  }
  return out;
}

function previousRange(fromIso: string, toIso: string): { from: string; to: string } {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const span = Math.max(0, to - from);
  const prevTo = new Date(from - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

function bandFromHour(hour: number): number {
  if (hour < 12) return 0;
  if (hour < 17) return 1;
  if (hour < 21) return 2;
  return 3;
}

async function summarizeRange(tx: TenantTx, filter: RangeFilter) {
  const rows = await tx.$queryRaw<
    Array<{
      session_count: number;
      total_attended: number;
      avg_rate: number | null;
      avg_duration_seconds: number | null;
    }>
  >`
    select
      count(*)::int as session_count,
      coalesce(sum(m.attended_count), 0)::int as total_attended,
      case
        when coalesce(sum(m.total_count), 0) = 0 then null
        else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
      end as avg_rate,
      case
        when coalesce(sum(m.duration_sample_count), 0) = 0 then null
        else round(sum(m.duration_sum)::numeric / nullif(sum(m.duration_sample_count), 0))::int
      end as avg_duration_seconds
    from (
      select
        (
          select count(*)::int from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
        ) as attended_count,
        (
          select count(*)::int from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as total_count,
        (
          select coalesce(sum(la.duration_seconds), 0)::bigint
          from live_attendance la
          where la.live_session_id = ls.id
            and la.tenant_id = ls.tenant_id
            and la.status = 'attended'
            and la.duration_seconds is not null
        ) as duration_sum,
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id
            and la.tenant_id = ls.tenant_id
            and la.status = 'attended'
            and la.duration_seconds is not null
        ) as duration_sample_count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and (${filter.courseId}::uuid is null or ls.course_id = ${filter.courseId}::uuid)
        and (${filter.batchId}::uuid is null or ls.batch_id = ${filter.batchId}::uuid)
        and coalesce(ls.started_at, ls.scheduled_at) >= ${filter.startedFrom}::timestamptz
        and coalesce(ls.started_at, ls.scheduled_at) <= ${filter.startedTo}::timestamptz
    ) m
  `;
  const row = rows[0];
  return {
    sessionCount: row?.session_count ?? 0,
    totalAttended: row?.total_attended ?? 0,
    avgAttendanceRate: row?.avg_rate == null ? null : row.avg_rate,
    avgDurationSeconds: row?.avg_duration_seconds == null ? null : row.avg_duration_seconds,
  };
}

export const superLiveInsightsTrendsRepository = {
  DAY_LABELS,
  BAND_LABELS,
  formatPeriodLabel,
  periodToInclusive,
  enumeratePeriods,
  previousRange,
  bandFromHour,

  summarizeRange,

  async listPeriodAggregates(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
  ): Promise<PeriodAggRow[]> {
    const unit = truncUnit(query.granularity);
    const courseId = query.courseId ?? null;
    const batchId = query.batchId ?? null;
    const rows = await tx.$queryRaw<PeriodAggRow[]>`
      with session_metrics as (
        select
          date_trunc(
            ${unit},
            timezone('UTC', coalesce(ls.started_at, ls.scheduled_at))
          ) as period_start,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
          ) as registered_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'absent'
          ) as absent_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count,
          (
            select coalesce(sum(la.duration_seconds), 0)::bigint
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
              and la.duration_seconds is not null
          ) as duration_sum,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
              and la.duration_seconds is not null
          ) as duration_sample_count
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
          and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
          and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
          and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      )
      select
        to_char(period_start, 'YYYY-MM-DD') as period_key,
        period_start,
        count(*)::int as session_count,
        coalesce(sum(attended_count), 0)::int as attended_count,
        coalesce(sum(registered_count), 0)::int as registered_count,
        coalesce(sum(absent_count), 0)::int as absent_count,
        coalesce(sum(total_count), 0)::int as total_count,
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as avg_rate,
        case
          when coalesce(sum(duration_sample_count), 0) = 0 then null
          else round(sum(duration_sum)::numeric / nullif(sum(duration_sample_count), 0))::int
        end as avg_duration_seconds
      from session_metrics
      group by period_start
      order by period_start asc
    `;
    return rows.map((row) => ({
      ...row,
      period_key: row.period_key,
      period_start:
        row.period_start instanceof Date
          ? row.period_start
          : new Date(`${row.period_key}T00:00:00.000Z`),
      session_count: row.session_count,
      attended_count: row.attended_count,
      registered_count: row.registered_count,
      absent_count: row.absent_count,
      total_count: row.total_count,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
      avg_duration_seconds: row.avg_duration_seconds == null ? null : row.avg_duration_seconds,
    }));
  },

  async listPeriodSegments(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
  ): Promise<SegmentAggRow[]> {
    if (query.breakDownBy === "none") return [];
    const unit = truncUnit(query.granularity);
    const courseId = query.courseId ?? null;
    const batchId = query.batchId ?? null;
    const by = query.breakDownBy;

    const rows = await tx.$queryRaw<SegmentAggRow[]>`
      with session_metrics as (
        select
          date_trunc(
            ${unit},
            timezone('UTC', coalesce(ls.started_at, ls.scheduled_at))
          ) as period_start,
          case
            when ${by} = 'course' then coalesce(ls.course_id::text, 'none')
            when ${by} = 'batch' then coalesce(ls.batch_id::text, 'none')
            else ls.status
          end as segment_key,
          case
            when ${by} = 'course' then coalesce(c.title, 'No course')
            when ${by} = 'batch' then coalesce(b.name, 'No batch')
            else initcap(ls.status::text)
          end as segment_label,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
          ) as registered_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'absent'
          ) as absent_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count
        from live_sessions ls
        left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
          and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
          and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
          and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      )
      select
        to_char(period_start, 'YYYY-MM-DD') as period_key,
        period_start,
        segment_key,
        segment_label,
        count(*)::int as session_count,
        coalesce(sum(attended_count), 0)::int as attended_count,
        coalesce(sum(registered_count), 0)::int as registered_count,
        coalesce(sum(absent_count), 0)::int as absent_count,
        coalesce(sum(total_count), 0)::int as total_count,
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as avg_rate
      from session_metrics
      group by period_start, segment_key, segment_label
      order by period_start asc, session_count desc
    `;
    return rows.map((row) => ({
      ...row,
      period_key: row.period_key,
      period_start:
        row.period_start instanceof Date
          ? row.period_start
          : new Date(`${row.period_key}T00:00:00.000Z`),
      session_count: row.session_count,
      attended_count: row.attended_count,
      registered_count: row.registered_count,
      absent_count: row.absent_count,
      total_count: row.total_count,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },

  async listDayTimeMatrix(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
  ): Promise<DayTimeRow[]> {
    const courseId = query.courseId ?? null;
    const batchId = query.batchId ?? null;
    const rows = await tx.$queryRaw<
      Array<{
        iso_dow: number;
        hour: number;
        session_count: number;
        avg_rate: number | null;
      }>
    >`
      select
        extract(isodow from timezone('UTC', coalesce(ls.started_at, ls.scheduled_at)))::int as iso_dow,
        extract(hour from timezone('UTC', coalesce(ls.started_at, ls.scheduled_at)))::int as hour,
        count(*)::int as session_count,
        case
          when coalesce(sum(m.total_count), 0) = 0 then null
          else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
        end as avg_rate
      from live_sessions ls
      cross join lateral (
        select
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count
      ) m
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
        and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      group by 1, 2
    `;

    const buckets = new Map<
      string,
      { session_count: number; rateWeighted: number; weight: number }
    >();
    for (const row of rows) {
      const dayIndex = row.iso_dow - 1; // 0 Mon .. 6 Sun
      const band = bandFromHour(row.hour);
      const key = `${dayIndex}:${band}`;
      const existing = buckets.get(key) ?? { session_count: 0, rateWeighted: 0, weight: 0 };
      const sessions = row.session_count;
      existing.session_count += sessions;
      if (row.avg_rate != null) {
        existing.rateWeighted += row.avg_rate * sessions;
        existing.weight += sessions;
      }
      buckets.set(key, existing);
    }

    const out: DayTimeRow[] = [];
    for (let day = 0; day < 7; day += 1) {
      for (let band = 0; band < 4; band += 1) {
        const bucket = buckets.get(`${day}:${band}`);
        out.push({
          dow: day,
          band,
          session_count: bucket?.session_count ?? 0,
          avg_rate:
            bucket && bucket.weight > 0
              ? Math.round((bucket.rateWeighted / bucket.weight) * 10) / 10
              : null,
        });
      }
    }
    return out;
  },

  async listRankedCourses(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
    limit = 6,
  ): Promise<RankedRow[]> {
    const courseId = query.courseId ?? null;
    const batchId = query.batchId ?? null;
    const rows = await tx.$queryRaw<RankedRow[]>`
      select
        coalesce(ls.course_id::text, 'none') as id,
        coalesce(c.title, 'No course') as title,
        count(*)::int as session_count,
        case
          when coalesce(sum(m.total_count), 0) = 0 then null
          else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
        end as avg_rate
      from live_sessions ls
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      cross join lateral (
        select
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count
      ) m
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and ls.course_id is not null
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
        and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      group by 1, 2
      order by avg_rate asc nulls last, session_count desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      session_count: row.session_count,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },

  async listRankedBatches(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
    limit = 6,
  ): Promise<RankedRow[]> {
    const courseId = query.courseId ?? null;
    const batchId = query.batchId ?? null;
    const rows = await tx.$queryRaw<RankedRow[]>`
      select
        coalesce(ls.batch_id::text, 'none') as id,
        coalesce(b.name, 'No batch') as title,
        count(*)::int as session_count,
        case
          when coalesce(sum(m.total_count), 0) = 0 then null
          else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
        end as avg_rate
      from live_sessions ls
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      cross join lateral (
        select
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count
      ) m
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and ls.batch_id is not null
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
        and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      group by 1, 2
      order by avg_rate asc nulls last, session_count desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      session_count: row.session_count,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },

  async listCourseSparklines(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
    courseIds: string[],
  ): Promise<SparkPoint[]> {
    if (courseIds.length === 0) return [];
    const unit = truncUnit(query.granularity);
    const rows = await tx.$queryRaw<SparkPoint[]>`
      select
        ls.course_id::text as id,
        to_char(
          date_trunc(${unit}, timezone('UTC', coalesce(ls.started_at, ls.scheduled_at))),
          'YYYY-MM-DD'
        ) as period_key,
        case
          when coalesce(sum(m.total_count), 0) = 0 then null
          else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
        end as avg_rate
      from live_sessions ls
      cross join lateral (
        select
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count
      ) m
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and ls.course_id::text = any(${courseIds}::text[])
        and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
        and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      group by 1, 2
      order by 1, 2
    `;
    return rows.map((row) => ({
      id: row.id,
      period_key: row.period_key,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },

  async listBatchSparklines(
    tx: TenantTx,
    query: SuperLiveInsightsTrendsQuery,
    batchIds: string[],
  ): Promise<SparkPoint[]> {
    if (batchIds.length === 0) return [];
    const unit = truncUnit(query.granularity);
    const rows = await tx.$queryRaw<SparkPoint[]>`
      select
        ls.batch_id::text as id,
        to_char(
          date_trunc(${unit}, timezone('UTC', coalesce(ls.started_at, ls.scheduled_at))),
          'YYYY-MM-DD'
        ) as period_key,
        case
          when coalesce(sum(m.total_count), 0) = 0 then null
          else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
        end as avg_rate
      from live_sessions ls
      cross join lateral (
        select
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) as attended_count,
          (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as total_count
      ) m
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and ls.batch_id::text = any(${batchIds}::text[])
        and coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom}::timestamptz
        and coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo}::timestamptz
      group by 1, 2
      order by 1, 2
    `;
    return rows.map((row) => ({
      id: row.id,
      period_key: row.period_key,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },
};
