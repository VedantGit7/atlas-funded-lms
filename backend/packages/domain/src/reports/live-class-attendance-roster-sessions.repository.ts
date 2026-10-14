import type { TenantTx } from "@atlas/db";
import type { LiveSessionsListQuery } from "./live-class-attendance-roster.dto";
import type {
  LiveSessionListRow,
  LiveSessionsSummaryRow,
} from "./live-class-attendance-roster.repository";

function mapSessionRow(row: Record<string, unknown>): LiveSessionListRow {
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
    attendance_count: Number(row["attendance_count"] ?? 0),
    registered_count: Number(row["registered_count"] ?? 0),
    avg_coverage_seconds:
      row["avg_coverage_seconds"] == null ? null : Number(row["avg_coverage_seconds"]),
  };
}

/**
 * Live sessions: the list, summary, one session and its attendance totals.
 * Part of liveClassAttendanceRosterRepository.
 */
export const liveClassAttendanceRosterSessionsRepository = {
  async countSessions(tx: TenantTx, query: LiveSessionsListQuery): Promise<number> {
    const band = query.attendanceRateBand ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with base as (
        select
          ls.id,
          ls.status,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
          ) as attendance_count,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as registered_count
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or ls.status = ${query.status ?? null})
          and (${query.courseId ?? null}::uuid is null or ls.course_id = ${query.courseId ?? null}::uuid)
          and (${query.batchId ?? null}::uuid is null or ls.batch_id = ${query.batchId ?? null}::uuid)
          and (
            ${query.q ?? null}::text is null
            or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.startedFrom ?? null}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom ?? null}::timestamptz
          )
          and (
            ${query.startedTo ?? null}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo ?? null}::timestamptz
          )
      )
      select count(*)::bigint as count
      from base
      where (
        ${band}::text is null
        or (
          registered_count > 0
          and (
            (${band} = 'below_40' and (attendance_count::float / registered_count) < 0.4)
            or (
              ${band} = 'mid_40_75'
              and (attendance_count::float / registered_count) >= 0.4
              and (attendance_count::float / registered_count) < 0.75
            )
            or (${band} = 'above_75' and (attendance_count::float / registered_count) >= 0.75)
          )
        )
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listSessions(tx: TenantTx, query: LiveSessionsListQuery): Promise<LiveSessionListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const band = query.attendanceRateBand ?? null;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with base as (
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
            else (
              select coalesce(sum(la.duration_seconds), 0)::int
              from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            )
          end as duration_seconds,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
          ) as attendance_count,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as registered_count,
          (
            select
              case
                when count(*) filter (where la.duration_seconds is not null) = 0 then null
                else round(avg(la.duration_seconds) filter (where la.duration_seconds is not null))::int
              end
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
          ) as avg_coverage_seconds
        from live_sessions ls
        left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or ls.status = ${query.status ?? null})
          and (${query.courseId ?? null}::uuid is null or ls.course_id = ${query.courseId ?? null}::uuid)
          and (${query.batchId ?? null}::uuid is null or ls.batch_id = ${query.batchId ?? null}::uuid)
          and (
            ${query.q ?? null}::text is null
            or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.startedFrom ?? null}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom ?? null}::timestamptz
          )
          and (
            ${query.startedTo ?? null}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo ?? null}::timestamptz
          )
      ),
      filtered as (
        select *
        from base
        where (
          ${band}::text is null
          or (
            registered_count > 0
            and (
              (${band} = 'below_40' and (attendance_count::float / registered_count) < 0.4)
              or (
                ${band} = 'mid_40_75'
                and (attendance_count::float / registered_count) >= 0.4
                and (attendance_count::float / registered_count) < 0.75
              )
              or (${band} = 'above_75' and (attendance_count::float / registered_count) >= 0.75)
            )
          )
        )
      )
      select *
      from filtered
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then title end asc nulls last,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then title end desc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'asc' then scheduled_at end asc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'desc' then scheduled_at end desc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'asc' then started_at end asc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'desc' then started_at end desc nulls last,
        case when ${sortBy} = 'attendance_count' and ${sortDir} = 'asc' then attendance_count end asc nulls last,
        case when ${sortBy} = 'attendance_count' and ${sortDir} = 'desc' then attendance_count end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then duration_seconds end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then duration_seconds end desc nulls last,
        scheduled_at desc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapSessionRow);
  },

  async summarizeSessions(
    tx: TenantTx,
    query: LiveSessionsListQuery,
  ): Promise<LiveSessionsSummaryRow> {
    const rows = await tx.$queryRaw<
      Array<{
        sessions_held: number;
        cancelled_count: number;
        scheduled_ahead_count: number;
        avg_attendance_pct: number | null;
        total_attended_count: number;
        total_registered_count: number;
        total_time_seconds: number;
        avg_coverage_pct: number | null;
        low_turnout_count: number;
      }>
    >`
      with base as (
        select
          ls.id,
          ls.status,
          ls.scheduled_at,
          case
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
            else null
          end as duration_seconds,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
          ) as attendance_count,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as registered_count,
          (
            select
              case
                when count(*) filter (where la.duration_seconds is not null) = 0 then null
                else round(avg(la.duration_seconds) filter (where la.duration_seconds is not null))::int
              end
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
          ) as avg_attendee_seconds
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.courseId ?? null}::uuid is null or ls.course_id = ${query.courseId ?? null}::uuid)
          and (${query.batchId ?? null}::uuid is null or ls.batch_id = ${query.batchId ?? null}::uuid)
          and (
            ${query.q ?? null}::text is null
            or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.startedFrom ?? null}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${query.startedFrom ?? null}::timestamptz
          )
          and (
            ${query.startedTo ?? null}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${query.startedTo ?? null}::timestamptz
          )
      )
      select
        count(*) filter (where status in ('ended', 'live'))::int as sessions_held,
        count(*) filter (where status = 'cancelled')::int as cancelled_count,
        count(*) filter (
          where status = 'scheduled' and (scheduled_at is null or scheduled_at > now())
        )::int as scheduled_ahead_count,
        case
          when coalesce(sum(registered_count) filter (where status in ('ended', 'live')), 0) = 0
            then null
          else round(
            (
              sum(attendance_count) filter (where status in ('ended', 'live'))::numeric
              / nullif(sum(registered_count) filter (where status in ('ended', 'live')), 0)
            ) * 1000
          ) / 10.0
        end as avg_attendance_pct,
        coalesce(sum(attendance_count) filter (where status in ('ended', 'live')), 0)::int
          as total_attended_count,
        coalesce(sum(registered_count) filter (where status in ('ended', 'live')), 0)::int
          as total_registered_count,
        coalesce(sum(duration_seconds) filter (where status in ('ended', 'live')), 0)::int
          as total_time_seconds,
        (
          select
            case
              when count(*) = 0 then null
              else round(avg(coverage) * 1000) / 10.0
            end
          from (
            select
              case
                when duration_seconds is null or duration_seconds = 0 or avg_attendee_seconds is null
                  then null
                else least(100.0, (avg_attendee_seconds::float / duration_seconds) * 100.0)
              end as coverage
            from base
            where status in ('ended', 'live')
          ) coverage_rows
          where coverage is not null
        ) as avg_coverage_pct,
        count(*) filter (
          where status in ('ended', 'live')
            and registered_count > 0
            and (attendance_count::float / registered_count) < 0.4
        )::int as low_turnout_count
      from base
    `;

    const row = rows[0];
    return {
      sessions_held: row?.sessions_held ?? 0,
      cancelled_count: row?.cancelled_count ?? 0,
      scheduled_ahead_count: row?.scheduled_ahead_count ?? 0,
      avg_attendance_pct: row?.avg_attendance_pct == null ? null : row.avg_attendance_pct,
      total_attended_count: row?.total_attended_count ?? 0,
      total_registered_count: row?.total_registered_count ?? 0,
      total_time_seconds: row?.total_time_seconds ?? 0,
      avg_coverage_pct: row?.avg_coverage_pct == null ? null : row.avg_coverage_pct,
      low_turnout_count: row?.low_turnout_count ?? 0,
    };
  },

  async findSessionById(tx: TenantTx, sessionId: string): Promise<LiveSessionListRow | null> {
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
          else (
            select coalesce(sum(la.duration_seconds), 0)::int
            from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          )
        end as duration_seconds,
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id
            and la.tenant_id = ls.tenant_id
            and la.status = 'attended'
        ) as attendance_count,
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as registered_count,
        (
          select
            case
              when count(*) filter (where la.duration_seconds is not null) = 0 then null
              else round(avg(la.duration_seconds) filter (where la.duration_seconds is not null))::int
            end
          from live_attendance la
          where la.live_session_id = ls.id
            and la.tenant_id = ls.tenant_id
            and la.status = 'attended'
        ) as avg_coverage_seconds
      from live_sessions ls
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.id = ${sessionId}::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapSessionRow(row) : null;
  },

  async sessionAttendanceTotals(
    tx: TenantTx,
    sessionId: string,
  ): Promise<{ totalAttendanceSeconds: number; avgDurationSeconds: number | null }> {
    const rows = await tx.$queryRaw<
      Array<{ total_seconds: number | null; avg_seconds: number | null }>
    >`
      select
        coalesce(sum(la.duration_seconds), 0)::int as total_seconds,
        case
          when count(*) filter (where la.duration_seconds is not null) = 0 then null
          else round(avg(la.duration_seconds) filter (where la.duration_seconds is not null))::int
        end as avg_seconds
      from live_attendance la
      where la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.status = 'attended'
    `;
    const row = rows[0];
    return {
      totalAttendanceSeconds: row?.total_seconds ?? 0,
      avgDurationSeconds: row?.avg_seconds == null ? null : row.avg_seconds,
    };
  },

  async listAttendanceIntervals(
    tx: TenantTx,
    sessionId: string,
  ): Promise<Array<{ joined_at: Date; left_at: Date | null; duration_seconds: number | null }>> {
    const rows = await tx.$queryRaw<
      Array<{
        joined_at: Date | null;
        left_at: Date | null;
        duration_seconds: number | null;
      }>
    >`
      select la.joined_at, la.left_at, la.duration_seconds
      from live_attendance la
      where la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.status = 'attended'
        and la.joined_at is not null
      order by la.joined_at asc
    `;
    return rows
      .filter(
        (row): row is { joined_at: Date; left_at: Date | null; duration_seconds: number | null } =>
          row.joined_at instanceof Date,
      )
      .map((row) => ({
        joined_at: row.joined_at,
        left_at: row.left_at instanceof Date ? row.left_at : null,
        duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
      }));
  },

  async countByStatus(
    tx: TenantTx,
    sessionId: string,
  ): Promise<{ attended: number; absent: number; registered: number }> {
    const rows = await tx.$queryRaw<Array<{ status: string; count: number }>>`
      select la.status, count(*)::int as count
      from live_attendance la
      where la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = current_setting('app.tenant_id', true)::uuid
      group by la.status
    `;
    const result = { attended: 0, absent: 0, registered: 0 };
    for (const row of rows) {
      if (row.status === "attended") result.attended = row.count;
      else if (row.status === "absent") result.absent = row.count;
      else if (row.status === "registered") result.registered = row.count;
    }
    return result;
  },

  async findNextSession(
    tx: TenantTx,
    sessionId: string,
  ): Promise<{ scheduled_at: Date | null; title: string } | null> {
    const rows = await tx.$queryRaw<Array<{ scheduled_at: Date | null; title: string }>>`
      with current_session as (
        select course_id, batch_id, coalesce(scheduled_at, started_at) as anchor
        from live_sessions
        where id = ${sessionId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        limit 1
      )
      select ls.scheduled_at, ls.title
      from live_sessions ls
      cross join current_session cs
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id <> ${sessionId}::uuid
        and ls.status = 'scheduled'
        and (
          (cs.course_id is not null and ls.course_id = cs.course_id)
          or (cs.batch_id is not null and ls.batch_id = cs.batch_id)
        )
        and coalesce(ls.scheduled_at, ls.started_at) > coalesce(cs.anchor, now())
      order by coalesce(ls.scheduled_at, ls.started_at) asc nulls last
      limit 1
    `;
    return rows[0] ?? null;
  },

  async historicalAttendanceRate(tx: TenantTx, sessionId: string): Promise<number | null> {
    const rows = await tx.$queryRaw<Array<{ rate: number | null }>>`
      with current_session as (
        select course_id, batch_id
        from live_sessions
        where id = ${sessionId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        limit 1
      ),
      ended as (
        select
          (
            select count(*)::float
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.status = 'attended'
          ) as attended,
          (
            select count(*)::float
            from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
          ) as registered
        from live_sessions ls
        cross join current_session cs
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.id <> ${sessionId}::uuid
          and ls.status = 'ended'
          and (
            (cs.course_id is not null and ls.course_id = cs.course_id)
            or (cs.batch_id is not null and ls.batch_id = cs.batch_id)
          )
      )
      select
        case
          when coalesce(sum(registered), 0) = 0 then null
          else round((sum(attended) / nullif(sum(registered), 0)) * 1000) / 10.0
        end as rate
      from ended
    `;
    const rate = rows[0]?.rate;
    return rate == null ? null : rate;
  },

  async listMembershipIdsByAudience(
    tx: TenantTx,
    sessionId: string,
    audience: "absentees" | "registrants" | "selected",
    membershipIds?: string[],
  ): Promise<string[]> {
    if (audience === "selected") {
      const ids = membershipIds ?? [];
      if (ids.length === 0) return [];
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select la.membership_id::text as membership_id
        from live_attendance la
        where la.live_session_id = ${sessionId}::uuid
          and la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and la.membership_id = any(${ids}::uuid[])
      `;
      return rows.map((row) => row.membership_id);
    }

    if (audience === "absentees") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select la.membership_id::text as membership_id
        from live_attendance la
        where la.live_session_id = ${sessionId}::uuid
          and la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            la.status = 'absent'
            or (la.status = 'registered' and la.joined_at is null)
          )
      `;
      return rows.map((row) => row.membership_id);
    }

    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select la.membership_id::text as membership_id
      from live_attendance la
      where la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    return rows.map((row) => row.membership_id);
  },
};
