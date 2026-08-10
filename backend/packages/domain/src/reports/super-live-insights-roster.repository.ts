import type { TenantTx } from "@atlas/db";
import type { SuperLiveInsightsListQuery } from "./super-live-insights-roster.dto";

export type SuperLiveInsightRow = {
  id: string;
  title: string;
  status: string;
  course_id: string | null;
  course_title: string | null;
  batch_id: string | null;
  batch_name: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  attended_count: number;
  registered_count: number;
  absent_count: number;
  total_count: number;
  avg_duration_seconds: number | null;
  attendance_rate: number | null;
};

type SessionFilter = {
  q?: string | null;
  status?: string | null;
  courseId?: string | null;
  batchId?: string | null;
  startedFrom?: string | null;
  startedTo?: string | null;
  minAttended?: number | null;
  hasUnresolved?: boolean | null;
  sessionId?: string | null;
};

function mapInsightRow(row: Record<string, unknown>): SuperLiveInsightRow {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    status: String(row["status"]),
    course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
    course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
    batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
    batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
    scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
    started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
    ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    attended_count: Number(row["attended_count"] ?? 0),
    registered_count: Number(row["registered_count"] ?? 0),
    absent_count: Number(row["absent_count"] ?? 0),
    total_count: Number(row["total_count"] ?? 0),
    avg_duration_seconds:
      row["avg_duration_seconds"] == null ? null : Number(row["avg_duration_seconds"]),
    attendance_rate: row["attendance_rate"] == null ? null : Number(row["attendance_rate"]),
  };
}

function fromQuery(query: SuperLiveInsightsListQuery): SessionFilter {
  return {
    q: query.q ?? null,
    status: query.status ?? null,
    courseId: query.courseId ?? null,
    batchId: query.batchId ?? null,
    startedFrom: query.startedFrom ?? null,
    startedTo: query.startedTo ?? null,
    minAttended: query.minAttended ?? null,
    hasUnresolved: query.hasUnresolved ?? null,
    sessionId: null,
  };
}

export const superLiveInsightsRosterRepository = {
  async countSessions(tx: TenantTx, query: SuperLiveInsightsListQuery): Promise<number> {
    const filter = fromQuery(query);
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.status}::text is null or ls.status = ${filter.status})
        and (${filter.courseId}::uuid is null or ls.course_id = ${filter.courseId}::uuid)
        and (${filter.batchId}::uuid is null or ls.batch_id = ${filter.batchId}::uuid)
        and (
          ${filter.q}::text is null
          or lower(ls.title) like '%' || lower(${filter.q}) || '%'
        )
        and (
          ${filter.startedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) >= ${filter.startedFrom}::timestamptz
        )
        and (
          ${filter.startedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) <= ${filter.startedTo}::timestamptz
        )
        and (
          ${filter.minAttended}::int is null
          or (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) >= ${filter.minAttended}::int
        )
        and (
          ${filter.hasUnresolved}::boolean is not true
          or (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
          ) > 0
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async summarizeSessions(
    tx: TenantTx,
    query: SuperLiveInsightsListQuery,
  ): Promise<{
    sessionCount: number;
    totalAttended: number;
    totalRegistered: number;
    totalAbsent: number;
    totalRecords: number;
    avgAttendanceRate: number | null;
    avgDurationSeconds: number | null;
  }> {
    const filter = fromQuery(query);
    const rows = await tx.$queryRaw<
      Array<{
        session_count: number;
        total_attended: number;
        total_registered: number;
        total_absent: number;
        total_records: number;
        avg_rate: number | null;
        avg_duration_seconds: number | null;
      }>
    >`
      select
        count(*)::int as session_count,
        coalesce(sum(m.attended_count), 0)::int as total_attended,
        coalesce(sum(m.registered_count), 0)::int as total_registered,
        coalesce(sum(m.absent_count), 0)::int as total_absent,
        coalesce(sum(m.total_count), 0)::int as total_records,
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
          and (${filter.status}::text is null or ls.status = ${filter.status})
          and (${filter.courseId}::uuid is null or ls.course_id = ${filter.courseId}::uuid)
          and (${filter.batchId}::uuid is null or ls.batch_id = ${filter.batchId}::uuid)
          and (
            ${filter.q}::text is null
            or lower(ls.title) like '%' || lower(${filter.q}) || '%'
          )
          and (
            ${filter.startedFrom}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${filter.startedFrom}::timestamptz
          )
          and (
            ${filter.startedTo}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${filter.startedTo}::timestamptz
          )
          and (
            ${filter.minAttended}::int is null
            or (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
            ) >= ${filter.minAttended}::int
          )
          and (
            ${filter.hasUnresolved}::boolean is not true
            or (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
            ) > 0
          )
      ) m
    `;
    const row = rows[0];
    return {
      sessionCount: row?.session_count ?? 0,
      totalAttended: row?.total_attended ?? 0,
      totalRegistered: row?.total_registered ?? 0,
      totalAbsent: row?.total_absent ?? 0,
      totalRecords: row?.total_records ?? 0,
      avgAttendanceRate: row?.avg_rate == null ? null : row.avg_rate,
      avgDurationSeconds: row?.avg_duration_seconds == null ? null : row.avg_duration_seconds,
    };
  },

  async listSessions(
    tx: TenantTx,
    query: SuperLiveInsightsListQuery,
  ): Promise<SuperLiveInsightRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const filter = fromQuery(query);

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.course_id::text as course_id,
        c.title as course_title,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
          else null
        end as duration_seconds,
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
          select
            case
              when count(*) filter (where la.duration_seconds is not null and la.status = 'attended') = 0
                then null
              else round(
                avg(la.duration_seconds) filter (
                  where la.duration_seconds is not null and la.status = 'attended'
                )
              )::int
            end
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as avg_duration_seconds,
        case
          when (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric from live_attendance la
                where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
              )
              / nullif(
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                ),
                0
              )
            ) * 100,
            1
          )::float8
        end as attendance_rate
      from live_sessions ls
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.status}::text is null or ls.status = ${filter.status})
        and (${filter.courseId}::uuid is null or ls.course_id = ${filter.courseId}::uuid)
        and (${filter.batchId}::uuid is null or ls.batch_id = ${filter.batchId}::uuid)
        and (
          ${filter.q}::text is null
          or lower(ls.title) like '%' || lower(${filter.q}) || '%'
        )
        and (
          ${filter.startedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) >= ${filter.startedFrom}::timestamptz
        )
        and (
          ${filter.startedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) <= ${filter.startedTo}::timestamptz
        )
        and (
          ${filter.minAttended}::int is null
          or (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          ) >= ${filter.minAttended}::int
        )
        and (
          ${filter.hasUnresolved}::boolean is not true
          or (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
          ) > 0
        )
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then ls.title end asc nulls last,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then ls.title end desc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'asc' then ls.scheduled_at end asc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'desc' then ls.scheduled_at end desc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'asc' then ls.started_at end asc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'desc' then ls.started_at end desc nulls last,
        case when ${sortBy} = 'attended_count' and ${sortDir} = 'asc' then (
          select count(*)::int from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
        ) end asc nulls last,
        case when ${sortBy} = 'attended_count' and ${sortDir} = 'desc' then (
          select count(*)::int from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
        ) end desc nulls last,
        case when ${sortBy} = 'registered_count' and ${sortDir} = 'asc' then (
          select count(*)::int from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
        ) end asc nulls last,
        case when ${sortBy} = 'registered_count' and ${sortDir} = 'desc' then (
          select count(*)::int from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'registered'
        ) end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then
          case when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int) else 0 end
        end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then
          case when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int) else 0 end
        end desc nulls last,
        case when ${sortBy} = 'attendance_rate' and ${sortDir} = 'asc' then
          case when (select count(*)::int from live_attendance la where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id) = 0
            then null
            else (
              select count(*)::float8 from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
            ) / nullif((
              select count(*)::float8 from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ), 0)
          end
        end asc nulls last,
        case when ${sortBy} = 'attendance_rate' and ${sortDir} = 'desc' then
          case when (select count(*)::int from live_attendance la where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id) = 0
            then null
            else (
              select count(*)::float8 from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
            ) / nullif((
              select count(*)::float8 from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ), 0)
          end
        end desc nulls last,
        case when ${sortBy} = 'avg_duration_seconds' and ${sortDir} = 'asc' then (
          select avg(la.duration_seconds) from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            and la.status = 'attended' and la.duration_seconds is not null
        ) end asc nulls last,
        case when ${sortBy} = 'avg_duration_seconds' and ${sortDir} = 'desc' then (
          select avg(la.duration_seconds) from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            and la.status = 'attended' and la.duration_seconds is not null
        ) end desc nulls last,
        ls.scheduled_at desc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapInsightRow);
  },

  async findSessionById(tx: TenantTx, sessionId: string): Promise<SuperLiveInsightRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.course_id::text as course_id,
        c.title as course_title,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
          else null
        end as duration_seconds,
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
          select
            case
              when count(*) filter (where la.duration_seconds is not null and la.status = 'attended') = 0
                then null
              else round(
                avg(la.duration_seconds) filter (
                  where la.duration_seconds is not null and la.status = 'attended'
                )
              )::int
            end
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as avg_duration_seconds,
        case
          when (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric from live_attendance la
                where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
              )
              / nullif(
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                ),
                0
              )
            ) * 100,
            1
          )::float8
        end as attendance_rate
      from live_sessions ls
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.id = ${sessionId}::uuid
        and ls.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapInsightRow(row) : null;
  },

  async findSessionUpdatedAt(tx: TenantTx, sessionId: string): Promise<Date | null> {
    const rows = await tx.$queryRaw<Array<{ updated_at: Date | null }>>`
      select ls.updated_at
      from live_sessions ls
      where ls.id = ${sessionId}::uuid
        and ls.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    return rows[0]?.updated_at ?? null;
  },

  async getSessionInsightContext(
    tx: TenantTx,
    session: SuperLiveInsightRow,
  ): Promise<{
    courseAvgAttendanceRate: number | null;
    tenantAvgAttendanceRate: number | null;
    courseRateP25: number | null;
    courseRateP75: number | null;
    courseAvgDurationSeconds: number | null;
    durationCoveragePct: number | null;
    rateDeltaVsCourse: number | null;
    courseRankCaption: string | null;
    estimatedTurnout: number | null;
    cancelledAt: Date | null;
    series: Array<{
      id: string;
      title: string;
      scheduledAt: Date | null;
      attendanceRate: number | null;
      isCurrent: boolean;
    }>;
    trend: Array<{
      id: string | null;
      title: string;
      label: string;
      attendanceRate: number | null;
      isCurrent: boolean;
      isFuture: boolean;
    }>;
    trendDeltaPoints: number | null;
  }> {
    const courseId = session.course_id;
    const batchId = session.batch_id;

    const [tenantAvgRows, courseStatsRows, seriesRows, trendRows, updatedAt] = await Promise.all([
      tx.$queryRaw<Array<{ avg_rate: number | null }>>`
        select
          case
            when coalesce(sum(m.total_count), 0) = 0 then null
            else round((sum(m.attended_count)::numeric / nullif(sum(m.total_count), 0)) * 100, 1)::float8
          end as avg_rate
        from (
          select
            (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
            ) as attended_count,
            (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ) as total_count
          from live_sessions ls
          where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
            and ls.status in ('ended', 'live')
        ) m
      `,
      courseId
        ? tx.$queryRaw<
            Array<{
              avg_rate: number | null;
              p25: number | null;
              p75: number | null;
              avg_duration: number | null;
              session_count: number;
              below_count: number;
            }>
          >`
            with rates as (
              select
                ls.id,
                case
                  when (
                    select count(*)::int from live_attendance la
                    where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                  ) = 0 then null
                  else round(
                    (
                      (
                        select count(*)::numeric from live_attendance la
                        where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
                      )
                      / nullif(
                        (
                          select count(*)::numeric from live_attendance la
                          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                        ),
                        0
                      )
                    ) * 100,
                    1
                  )::float8
                end as attendance_rate,
                (
                  select
                    case
                      when count(*) filter (where la.duration_seconds is not null and la.status = 'attended') = 0
                        then null
                      else round(avg(la.duration_seconds) filter (
                        where la.duration_seconds is not null and la.status = 'attended'
                      ))::int
                    end
                  from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                ) as avg_duration_seconds
              from live_sessions ls
              where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
                and ls.course_id = ${courseId}::uuid
                and ls.status in ('ended', 'live')
            ),
            rated as (
              select * from rates where attendance_rate is not null
            )
            select
              (select round(avg(attendance_rate), 1)::float8 from rated) as avg_rate,
              (select percentile_cont(0.25) within group (order by attendance_rate)::float8 from rated) as p25,
              (select percentile_cont(0.75) within group (order by attendance_rate)::float8 from rated) as p75,
              (
                select round(avg(avg_duration_seconds))::int
                from rates
                where avg_duration_seconds is not null
              ) as avg_duration,
              (select count(*)::int from rates) as session_count,
              (
                select count(*)::int
                from rated
                where ${session.attendance_rate}::float8 is not null
                  and attendance_rate < ${session.attendance_rate}::float8
              ) as below_count
          `
        : Promise.resolve([
            {
              avg_rate: null,
              p25: null,
              p75: null,
              avg_duration: null,
              session_count: 0,
              below_count: 0,
            },
          ]),
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          scheduled_at: Date | null;
          attendance_rate: number | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.scheduled_at,
          case
            when (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ) = 0 then null
            else round(
              (
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
                )
                / nullif(
                  (
                    select count(*)::numeric from live_attendance la
                    where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                  ),
                  0
                )
              ) * 100,
              1
            )::float8
          end as attendance_rate
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (${courseId}::uuid is not null and ls.course_id = ${courseId}::uuid)
            or (${courseId}::uuid is null and ${batchId}::uuid is not null and ls.batch_id = ${batchId}::uuid)
            or (${courseId}::uuid is null and ${batchId}::uuid is null and ls.id = ${session.id}::uuid)
          )
        order by coalesce(ls.scheduled_at, ls.started_at, ls.created_at) asc nulls last
        limit 40
      `,
      tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          scheduled_at: Date | null;
          status: string;
          attendance_rate: number | null;
        }>
      >`
        select
          ls.id::text as id,
          ls.title,
          ls.scheduled_at,
          ls.status,
          case
            when ls.status = 'scheduled' or (
              select count(*)::int from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ) = 0 then null
            else round(
              (
                (
                  select count(*)::numeric from live_attendance la
                  where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
                )
                / nullif(
                  (
                    select count(*)::numeric from live_attendance la
                    where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
                  ),
                  0
                )
              ) * 100,
              1
            )::float8
          end as attendance_rate
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (${courseId}::uuid is not null and ls.course_id = ${courseId}::uuid)
            or (${courseId}::uuid is null and ${batchId}::uuid is not null and ls.batch_id = ${batchId}::uuid)
            or (${courseId}::uuid is null and ${batchId}::uuid is null and ls.id = ${session.id}::uuid)
          )
        order by coalesce(ls.scheduled_at, ls.started_at, ls.created_at) asc nulls last
        limit 12
      `,
      session.status === "cancelled"
        ? this.findSessionUpdatedAt(tx, session.id)
        : Promise.resolve(null),
    ]);

    const courseStats = courseStatsRows[0];
    const courseAvg = courseStats?.avg_rate == null ? null : courseStats.avg_rate;
    const tenantAvg = tenantAvgRows[0]?.avg_rate == null ? null : tenantAvgRows[0].avg_rate;
    const rateDeltaVsCourse =
      session.attendance_rate != null && courseAvg != null
        ? Math.round((session.attendance_rate - courseAvg) * 10) / 10
        : null;

    let courseRankCaption: string | null = null;
    if (
      session.attendance_rate != null &&
      courseStats &&
      courseStats.session_count > 0 &&
      courseId
    ) {
      const rankRatio =
        courseStats.session_count <= 1
          ? 0.5
          : courseStats.below_count / Math.max(1, courseStats.session_count - 1);
      if (rankRatio <= 0.33) courseRankCaption = "Bottom third of sessions in this course.";
      else if (rankRatio >= 0.67) courseRankCaption = "Top third of sessions in this course.";
      else courseRankCaption = "Middle third of sessions in this course.";
    }

    const durationCoveragePct =
      session.avg_duration_seconds != null &&
      session.duration_seconds != null &&
      session.duration_seconds > 0
        ? Math.min(
            100,
            Math.round((session.avg_duration_seconds / session.duration_seconds) * 1000) / 10,
          )
        : null;

    const estimatedTurnout =
      session.status === "scheduled" && courseAvg != null && session.registered_count > 0
        ? Math.round((session.registered_count * courseAvg) / 100)
        : null;

    const currentIndex = seriesRows.findIndex((row) => row.id === session.id);
    const seriesWindow =
      currentIndex >= 0
        ? seriesRows.slice(Math.max(0, currentIndex - 2), currentIndex + 3)
        : seriesRows.slice(0, 5);

    const series = seriesWindow.map((row) => ({
      id: row.id,
      title: row.title,
      scheduledAt: row.scheduled_at,
      attendanceRate: row.attendance_rate == null ? null : row.attendance_rate,
      isCurrent: row.id === session.id,
    }));

    const trend = trendRows.map((row, index) => ({
      id: row.id,
      title: row.title,
      label: `Wk ${index + 1}`,
      attendanceRate: row.attendance_rate == null ? null : row.attendance_rate,
      isCurrent: row.id === session.id,
      isFuture: row.status === "scheduled",
    }));

    const heldRates = trend
      .filter((item) => !item.isFuture && item.attendanceRate != null)
      .map((item) => item.attendanceRate as number);
    let trendDeltaPoints: number | null = null;
    if (heldRates.length >= 2) {
      const recent = heldRates.slice(-4);
      const firstRecent = recent[0];
      const lastRecent = recent[recent.length - 1];
      if (recent.length >= 2 && firstRecent != null && lastRecent != null) {
        trendDeltaPoints = Math.round((lastRecent - firstRecent) * 10) / 10;
      }
    }

    return {
      courseAvgAttendanceRate: courseAvg,
      tenantAvgAttendanceRate: tenantAvg,
      courseRateP25: courseStats?.p25 == null ? null : courseStats.p25,
      courseRateP75: courseStats?.p75 == null ? null : courseStats.p75,
      courseAvgDurationSeconds: courseStats?.avg_duration == null ? null : courseStats.avg_duration,
      durationCoveragePct,
      rateDeltaVsCourse,
      courseRankCaption,
      estimatedTurnout,
      cancelledAt: updatedAt,
      series,
      trend,
      trendDeltaPoints,
    };
  },
};
