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
    duration_seconds:
      row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
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
    avgAttendanceRate: number | null;
  }> {
    const filter = fromQuery(query);
    const rows = await tx.$queryRaw<
      Array<{
        session_count: number;
        total_attended: number;
        total_registered: number;
        avg_rate: number | null;
      }>
    >`
      select
        count(*)::int as session_count,
        coalesce(sum(m.attended_count), 0)::int as total_attended,
        coalesce(sum(m.total_count), 0)::int as total_registered,
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
      ) m
    `;
    const row = rows[0];
    return {
      sessionCount: Number(row?.session_count ?? 0),
      totalAttended: Number(row?.total_attended ?? 0),
      totalRegistered: Number(row?.total_registered ?? 0),
      avgAttendanceRate: row?.avg_rate == null ? null : Number(row.avg_rate),
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
      limit 1
    `;
    const row = rows[0];
    return row ? mapInsightRow(row) : null;
  },
};
