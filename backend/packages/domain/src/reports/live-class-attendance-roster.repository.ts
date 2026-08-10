import type { TenantTx } from "@atlas/db";
import type { LiveAttendeesQuery, LiveSessionsListQuery } from "./live-class-attendance-roster.dto";

export type LiveSessionListRow = {
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
  attendance_count: number;
  registered_count: number;
  avg_coverage_seconds: number | null;
};

export type LiveSessionsSummaryRow = {
  sessions_held: number;
  cancelled_count: number;
  scheduled_ahead_count: number;
  avg_attendance_pct: number | null;
  total_attended_count: number;
  total_registered_count: number;
  total_time_seconds: number;
  avg_coverage_pct: number | null;
  low_turnout_count: number;
};

export type LiveAttendeeRow = {
  id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
};

export type LiveAttendeesFilter = {
  sessionId: string;
  learnerName?: string;
  email?: string;
  status?: string;
  joinedFrom?: string;
  joinedTo?: string;
};

function pickDefinedLearnerFilter<T extends Record<string, unknown>>(value: T): Partial<T> {
  const next: Partial<T> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      (next as Record<string, unknown>)[key] = entry;
    }
  }
  return next;
}

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

function mapAttendeeRow(row: Record<string, unknown>): LiveAttendeeRow {
  return {
    id: String(row["id"]),
    membership_id: String(row["membership_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    status: String(row["status"]),
    joined_at: row["joined_at"] instanceof Date ? row["joined_at"] : null,
    left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
  };
}

export const liveClassAttendanceRosterRepository = {
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

  async countAttendees(tx: TenantTx, filter: LiveAttendeesFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from live_attendance la
      join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${filter.sessionId}::uuid
        and (${filter.status ?? null}::text is null or la.status = ${filter.status ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and (
          ${filter.joinedFrom ?? null}::timestamptz is null
          or la.joined_at >= ${filter.joinedFrom ?? null}::timestamptz
        )
        and (
          ${filter.joinedTo ?? null}::timestamptz is null
          or la.joined_at <= ${filter.joinedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listAttendees(
    tx: TenantTx,
    sessionId: string,
    query: LiveAttendeesQuery,
  ): Promise<LiveAttendeeRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.id::text as id,
        la.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        la.status,
        la.joined_at,
        la.left_at,
        la.duration_seconds
      from live_attendance la
      join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${sessionId}::uuid
        and (${query.status ?? null}::text is null or la.status = ${query.status ?? null})
        and (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (
          ${query.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.email ?? null}) || '%'
        )
        and (
          ${query.joinedFrom ?? null}::timestamptz is null
          or la.joined_at >= ${query.joinedFrom ?? null}::timestamptz
        )
        and (
          ${query.joinedTo ?? null}::timestamptz is null
          or la.joined_at <= ${query.joinedTo ?? null}::timestamptz
        )
      order by
        case when ${sortBy} = 'learner_name' and ${sortDir} = 'asc'
          then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end asc nulls last,
        case when ${sortBy} = 'learner_name' and ${sortDir} = 'desc'
          then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end desc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'asc'
          then coalesce(ap.email, m.invited_email_normalized) end asc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'desc'
          then coalesce(ap.email, m.invited_email_normalized) end desc nulls last,
        case when ${sortBy} = 'status' and ${sortDir} = 'asc' then la.status end asc nulls last,
        case when ${sortBy} = 'status' and ${sortDir} = 'desc' then la.status end desc nulls last,
        case when ${sortBy} = 'joined_at' and ${sortDir} = 'asc' then la.joined_at end asc nulls last,
        case when ${sortBy} = 'joined_at' and ${sortDir} = 'desc' then la.joined_at end desc nulls last,
        case when ${sortBy} = 'left_at' and ${sortDir} = 'asc' then la.left_at end asc nulls last,
        case when ${sortBy} = 'left_at' and ${sortDir} = 'desc' then la.left_at end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then la.duration_seconds end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then la.duration_seconds end desc nulls last,
        la.joined_at asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapAttendeeRow);
  },

  async findAttendeeById(
    tx: TenantTx,
    sessionId: string,
    attendeeId: string,
  ): Promise<{
    id: string;
    membership_id: string;
    learner_name: string | null;
    email: string | null;
    status: string;
    joined_at: Date | null;
    left_at: Date | null;
    duration_seconds: number | null;
    created_at: Date | null;
    override_reason: string | null;
    overridden_at: Date | null;
    overridden_by_membership_id: string | null;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.id::text as id,
        la.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        la.status,
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        la.created_at,
        la.override_reason,
        la.overridden_at,
        la.overridden_by_membership_id::text as overridden_by_membership_id
      from live_attendance la
      join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${sessionId}::uuid
        and la.id = ${attendeeId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row["id"]),
      membership_id: String(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      status: String(row["status"]),
      joined_at: row["joined_at"] instanceof Date ? row["joined_at"] : null,
      left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      created_at: row["created_at"] instanceof Date ? row["created_at"] : null,
      override_reason: typeof row["override_reason"] === "string" ? row["override_reason"] : null,
      overridden_at: row["overridden_at"] instanceof Date ? row["overridden_at"] : null,
      overridden_by_membership_id:
        typeof row["overridden_by_membership_id"] === "string"
          ? row["overridden_by_membership_id"]
          : null,
    };
  },

  async listSessionAttendedDurations(tx: TenantTx, sessionId: string): Promise<number[]> {
    const rows = await tx.$queryRaw<Array<{ duration_seconds: number | null }>>`
      select la.duration_seconds
      from live_attendance la
      where la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.status = 'attended'
        and la.duration_seconds is not null
      order by la.duration_seconds asc
    `;
    return rows
      .map((row) => row.duration_seconds)
      .filter((value): value is number => value != null && Number.isFinite(value));
  },

  async listLearnerAttendanceHistory(
    tx: TenantTx,
    args: {
      sessionId: string;
      membershipId: string;
      limit?: number;
    },
  ): Promise<
    Array<{
      session_id: string;
      attendee_id: string | null;
      title: string;
      scheduled_at: Date | null;
      status: string;
      duration_seconds: number | null;
      session_duration_seconds: number | null;
      is_current: boolean;
    }>
  > {
    const limit = args.limit ?? 10;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with current_session as (
        select course_id, batch_id
        from live_sessions
        where id = ${args.sessionId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        limit 1
      )
      select
        ls.id::text as session_id,
        la.id::text as attendee_id,
        ls.title,
        coalesce(ls.scheduled_at, ls.started_at) as scheduled_at,
        coalesce(la.status, 'registered') as status,
        la.duration_seconds,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
          else null
        end as session_duration_seconds,
        (ls.id = ${args.sessionId}::uuid) as is_current
      from live_sessions ls
      cross join current_session cs
      left join live_attendance la
        on la.live_session_id = ls.id
        and la.tenant_id = ls.tenant_id
        and la.membership_id = ${args.membershipId}::uuid
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          (cs.batch_id is not null and ls.batch_id = cs.batch_id)
          or (cs.batch_id is null and cs.course_id is not null and ls.course_id = cs.course_id)
          or ls.id = ${args.sessionId}::uuid
        )
        and la.id is not null
      order by
        (ls.id = ${args.sessionId}::uuid) desc,
        coalesce(ls.scheduled_at, ls.started_at) desc nulls last
      limit ${limit}
    `;

    return rows.map((row) => ({
      session_id: String(row["session_id"]),
      attendee_id: typeof row["attendee_id"] === "string" ? row["attendee_id"] : null,
      title: String(row["title"]),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      status: String(row["status"]),
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      session_duration_seconds:
        row["session_duration_seconds"] == null ? null : Number(row["session_duration_seconds"]),
      is_current: Boolean(row["is_current"]),
    }));
  },

  async countLearnerAttendanceHistory(
    tx: TenantTx,
    args: { sessionId: string; membershipId: string },
  ): Promise<{ total_sessions: number; attended_count: number }> {
    const rows = await tx.$queryRaw<Array<{ total_sessions: number; attended_count: number }>>`
      with current_session as (
        select course_id, batch_id
        from live_sessions
        where id = ${args.sessionId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        limit 1
      )
      select
        count(*)::int as total_sessions,
        count(*) filter (where la.status = 'attended')::int as attended_count
      from live_attendance la
      join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
      cross join current_session cs
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.membership_id = ${args.membershipId}::uuid
        and (
          (cs.batch_id is not null and ls.batch_id = cs.batch_id)
          or (cs.batch_id is null and cs.course_id is not null and ls.course_id = cs.course_id)
          or ls.id = ${args.sessionId}::uuid
        )
    `;
    return {
      total_sessions: rows[0]?.total_sessions ?? 0,
      attended_count: rows[0]?.attended_count ?? 0,
    };
  },

  async updateAttendeeStatus(
    tx: TenantTx,
    args: {
      sessionId: string;
      attendeeId: string;
      status: string;
      reason: string | null;
      actorMembershipId: string;
    },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      update live_attendance
      set
        status = ${args.status},
        override_reason = ${args.reason},
        overridden_at = now(),
        overridden_by_membership_id = ${args.actorMembershipId}::uuid,
        updated_at = now()
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and live_session_id = ${args.sessionId}::uuid
        and id = ${args.attendeeId}::uuid
      returning id::text as id
    `;
    return rows.length > 0;
  },

  async listLiveMonitorRoster(
    tx: TenantTx,
    sessionId: string,
  ): Promise<
    Array<{
      id: string;
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      status: string;
      joined_at: Date | null;
      left_at: Date | null;
      duration_seconds: number | null;
      batch_id: string | null;
      batch_name: string | null;
      last_session_status: string | null;
      history_attended: number;
      history_total: number;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with current_session as (
        select course_id, batch_id
        from live_sessions
        where id = ${sessionId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        limit 1
      ),
      history as (
        select
          la.membership_id,
          count(*)::int as history_total,
          count(*) filter (where la.status = 'attended')::int as history_attended
        from live_attendance la
        join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
        cross join current_session cs
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (cs.batch_id is not null and ls.batch_id = cs.batch_id)
            or (cs.batch_id is null and cs.course_id is not null and ls.course_id = cs.course_id)
            or ls.id = ${sessionId}::uuid
          )
        group by la.membership_id
      ),
      previous as (
        select distinct on (la.membership_id)
          la.membership_id,
          la.status as last_session_status
        from live_attendance la
        join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
        cross join current_session cs
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.id <> ${sessionId}::uuid
          and (
            (cs.batch_id is not null and ls.batch_id = cs.batch_id)
            or (cs.batch_id is null and cs.course_id is not null and ls.course_id = cs.course_id)
          )
        order by la.membership_id, coalesce(ls.scheduled_at, ls.started_at) desc nulls last
      )
      select
        la.id::text as id,
        la.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        la.status,
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        cs.batch_id::text as batch_id,
        b.name as batch_name,
        prev.last_session_status,
        coalesce(h.history_attended, 0)::int as history_attended,
        coalesce(h.history_total, 0)::int as history_total
      from live_attendance la
      cross join current_session cs
      join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join batches b on b.id = cs.batch_id and b.tenant_id = la.tenant_id
      left join history h on h.membership_id = la.membership_id
      left join previous prev on prev.membership_id = la.membership_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${sessionId}::uuid
      order by
        case when la.joined_at is null then 0 else 1 end asc,
        coalesce(h.history_attended::float / nullif(h.history_total, 0), 0) asc,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) asc nulls last
      limit 500
    `;

    return rows.map((row) => ({
      id: String(row["id"]),
      membership_id: String(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      status: String(row["status"]),
      joined_at: row["joined_at"] instanceof Date ? row["joined_at"] : null,
      left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      last_session_status:
        typeof row["last_session_status"] === "string" ? row["last_session_status"] : null,
      history_attended: Number(row["history_attended"] ?? 0),
      history_total: Number(row["history_total"] ?? 0),
    }));
  },

  async summarizeLearnersRollup(
    tx: TenantTx,
    filter: {
      q?: string | undefined;
      courseId?: string | undefined;
      batchId?: string | undefined;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<{
    learners_registered: number;
    avg_attendance_rate_pct: number | null;
    never_attended_count: number;
    perfect_attendance_count: number;
    avg_coverage_pct: number | null;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        learners_registered: number;
        avg_attendance_rate_pct: number | null;
        never_attended_count: number;
        perfect_attendance_count: number;
        avg_coverage_pct: number | null;
      }>
    >`
      with scoped_sessions as (
        select ls.id, ls.batch_id, ls.started_at, ls.ended_at, ls.scheduled_at
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and (${filter.courseId ?? null}::uuid is null or ls.course_id = ${filter.courseId ?? null}::uuid)
          and (${filter.batchId ?? null}::uuid is null or ls.batch_id = ${filter.batchId ?? null}::uuid)
          and (
            ${filter.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${filter.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${filter.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${filter.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          la.membership_id,
          count(*)::int as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::int as attended_count,
          coalesce(sum(la.duration_seconds) filter (where la.duration_seconds is not null), 0)::int as total_time_seconds,
          avg(
            case
              when la.duration_seconds is null then null
              when ss.started_at is not null and ss.ended_at is not null
                and extract(epoch from (ss.ended_at - ss.started_at)) > 0
                then least(
                  100.0,
                  (la.duration_seconds::float / extract(epoch from (ss.ended_at - ss.started_at))) * 100.0
                )
              else null
            end
          ) as avg_coverage_pct
        from live_attendance la
        join scoped_sessions ss on ss.id = la.live_session_id
        join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${filter.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
          )
        group by la.membership_id
      )
      select
        count(*)::int as learners_registered,
        case
          when count(*) = 0 then null
          else round(avg(
            case when registered_count = 0 then null
            else (attended_count::float / registered_count::float) * 100.0 end
          )::numeric, 1)::float
        end as avg_attendance_rate_pct,
        count(*) filter (where attended_count = 0)::int as never_attended_count,
        count(*) filter (
          where registered_count > 0 and attended_count = registered_count
        )::int as perfect_attendance_count,
        case
          when count(*) filter (where avg_coverage_pct is not null) = 0 then null
          else round(avg(avg_coverage_pct)::numeric, 1)::float
        end as avg_coverage_pct
      from per_learner
    `;
    const row = rows[0];
    return {
      learners_registered: row?.learners_registered ?? 0,
      avg_attendance_rate_pct:
        row?.avg_attendance_rate_pct == null ? null : row.avg_attendance_rate_pct,
      never_attended_count: row?.never_attended_count ?? 0,
      perfect_attendance_count: row?.perfect_attendance_count ?? 0,
      avg_coverage_pct: row?.avg_coverage_pct == null ? null : row.avg_coverage_pct,
    };
  },

  async countLearnersRollup(
    tx: TenantTx,
    filter: {
      q?: string | undefined;
      courseId?: string | undefined;
      batchId?: string | undefined;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
      attendanceRateBand?: string | undefined;
      sessionsRegisteredBand?: string | undefined;
      lastAttended?: string | undefined;
    },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      with scoped_sessions as (
        select ls.id, ls.batch_id, ls.started_at, ls.ended_at, ls.scheduled_at
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and (${filter.courseId ?? null}::uuid is null or ls.course_id = ${filter.courseId ?? null}::uuid)
          and (${filter.batchId ?? null}::uuid is null or ls.batch_id = ${filter.batchId ?? null}::uuid)
          and (
            ${filter.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${filter.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${filter.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${filter.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          la.membership_id,
          count(*)::int as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::int as attended_count,
          max(la.joined_at) as last_attended_at
        from live_attendance la
        join scoped_sessions ss on ss.id = la.live_session_id
        join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${filter.q ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.q ?? null}) || '%'
          )
        group by la.membership_id
      )
      select count(*)::int as count
      from per_learner pl
      where (
        ${filter.attendanceRateBand ?? null}::text is null
        or (
          ${filter.attendanceRateBand ?? null} = 'never_attended' and pl.attended_count = 0
        )
        or (
          ${filter.attendanceRateBand ?? null} = 'perfect'
          and pl.registered_count > 0 and pl.attended_count = pl.registered_count
        )
        or (
          ${filter.attendanceRateBand ?? null} = 'below_40'
          and pl.registered_count > 0
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 < 40
          and pl.attended_count > 0
        )
        or (
          ${filter.attendanceRateBand ?? null} = 'mid_40_75'
          and pl.registered_count > 0
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 >= 40
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 < 75
        )
        or (
          ${filter.attendanceRateBand ?? null} = 'above_75'
          and pl.registered_count > 0
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 >= 75
          and pl.attended_count < pl.registered_count
        )
      )
      and (
        ${filter.sessionsRegisteredBand ?? null}::text is null
        or (${filter.sessionsRegisteredBand ?? null} = '1' and pl.registered_count = 1)
        or (${filter.sessionsRegisteredBand ?? null} = '2_5' and pl.registered_count between 2 and 5)
        or (${filter.sessionsRegisteredBand ?? null} = 'gt_5' and pl.registered_count > 5)
      )
      and (
        ${filter.lastAttended ?? null}::text is null
        or (${filter.lastAttended ?? null} = 'never' and pl.last_attended_at is null)
        or (
          ${filter.lastAttended ?? null} = 'last_7d'
          and pl.last_attended_at >= now() - interval '7 days'
        )
        or (
          ${filter.lastAttended ?? null} = 'last_30d'
          and pl.last_attended_at >= now() - interval '30 days'
        )
        or (
          ${filter.lastAttended ?? null} = 'not_in_30d'
          and (pl.last_attended_at is null or pl.last_attended_at < now() - interval '30 days')
        )
      )
    `;
    return rows[0]?.count ?? 0;
  },

  async listLearnersRollup(
    tx: TenantTx,
    query: {
      q?: string | undefined;
      courseId?: string | undefined;
      batchId?: string | undefined;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
      attendanceRateBand?: string | undefined;
      sessionsRegisteredBand?: string | undefined;
      lastAttended?: string | undefined;
      sortBy: string;
      sortDir: string;
      limit: number;
      page: number;
    },
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      batch_id: string | null;
      batch_name: string | null;
      registered_count: number;
      attended_count: number;
      absent_count: number;
      attendance_rate_pct: number | null;
      total_time_seconds: number;
      avg_coverage_pct: number | null;
      last_attended_at: Date | null;
      last_attended_session_id: string | null;
      last_attended_session_title: string | null;
      recent_statuses: string[];
    }>
  > {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped_sessions as (
        select ls.id, ls.batch_id, ls.started_at, ls.ended_at, ls.scheduled_at, ls.title
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and (${query.courseId ?? null}::uuid is null or ls.course_id = ${query.courseId ?? null}::uuid)
          and (${query.batchId ?? null}::uuid is null or ls.batch_id = ${query.batchId ?? null}::uuid)
          and (
            ${query.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${query.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${query.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${query.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          la.membership_id,
          count(*)::int as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::int as attended_count,
          count(*) filter (
            where la.status = 'absent'
              or (la.status = 'registered' and la.joined_at is null)
          )::int as absent_count,
          coalesce(sum(la.duration_seconds) filter (where la.duration_seconds is not null), 0)::int
            as total_time_seconds,
          avg(
            case
              when la.duration_seconds is null then null
              when ss.started_at is not null and ss.ended_at is not null
                and extract(epoch from (ss.ended_at - ss.started_at)) > 0
                then least(
                  100.0,
                  (la.duration_seconds::float / extract(epoch from (ss.ended_at - ss.started_at))) * 100.0
                )
              else null
            end
          ) as avg_coverage_pct,
          max(la.joined_at) as last_attended_at
        from live_attendance la
        join scoped_sessions ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.membership_id
      ),
      last_session as (
        select distinct on (la.membership_id)
          la.membership_id,
          ls.id::text as last_attended_session_id,
          ls.title as last_attended_session_title
        from live_attendance la
        join scoped_sessions ls on ls.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and la.joined_at is not null
        order by la.membership_id, la.joined_at desc
      ),
      recent as (
        select
          la.membership_id,
          array_agg(
            case
              when la.status = 'attended' or la.joined_at is not null then 'attended'
              else 'missed'
            end
            order by coalesce(ss.scheduled_at, ss.started_at, la.created_at) desc
          ) as recent_statuses
        from live_attendance la
        join scoped_sessions ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.membership_id
      ),
      primary_batch as (
        select distinct on (la.membership_id)
          la.membership_id,
          ss.batch_id
        from live_attendance la
        join scoped_sessions ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ss.batch_id is not null
        order by la.membership_id, coalesce(ss.scheduled_at, ss.started_at) desc nulls last
      )
      select
        pl.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        pb.batch_id::text as batch_id,
        b.name as batch_name,
        pl.registered_count,
        pl.attended_count,
        pl.absent_count,
        case
          when pl.registered_count = 0 then null
          else round(((pl.attended_count::float / pl.registered_count::float) * 100.0)::numeric, 1)::float
        end as attendance_rate_pct,
        pl.total_time_seconds,
        case when pl.avg_coverage_pct is null then null
          else round(pl.avg_coverage_pct::numeric, 1)::float end as avg_coverage_pct,
        pl.last_attended_at,
        lsess.last_attended_session_id,
        lsess.last_attended_session_title,
        coalesce(r.recent_statuses, '{}'::text[]) as recent_statuses
      from per_learner pl
      join memberships m on m.id = pl.membership_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join last_session lsess on lsess.membership_id = pl.membership_id
      left join recent r on r.membership_id = pl.membership_id
      left join primary_batch pb on pb.membership_id = pl.membership_id
      left join batches b on b.id = pb.batch_id and b.tenant_id = m.tenant_id
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${query.q ?? null}) || '%'
      )
      and (
        ${query.attendanceRateBand ?? null}::text is null
        or (
          ${query.attendanceRateBand ?? null} = 'never_attended' and pl.attended_count = 0
        )
        or (
          ${query.attendanceRateBand ?? null} = 'perfect'
          and pl.registered_count > 0 and pl.attended_count = pl.registered_count
        )
        or (
          ${query.attendanceRateBand ?? null} = 'below_40'
          and pl.registered_count > 0
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 < 40
          and pl.attended_count > 0
        )
        or (
          ${query.attendanceRateBand ?? null} = 'mid_40_75'
          and pl.registered_count > 0
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 >= 40
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 < 75
        )
        or (
          ${query.attendanceRateBand ?? null} = 'above_75'
          and pl.registered_count > 0
          and (pl.attended_count::float / pl.registered_count::float) * 100.0 >= 75
          and pl.attended_count < pl.registered_count
        )
      )
      and (
        ${query.sessionsRegisteredBand ?? null}::text is null
        or (${query.sessionsRegisteredBand ?? null} = '1' and pl.registered_count = 1)
        or (${query.sessionsRegisteredBand ?? null} = '2_5' and pl.registered_count between 2 and 5)
        or (${query.sessionsRegisteredBand ?? null} = 'gt_5' and pl.registered_count > 5)
      )
      and (
        ${query.lastAttended ?? null}::text is null
        or (${query.lastAttended ?? null} = 'never' and pl.last_attended_at is null)
        or (
          ${query.lastAttended ?? null} = 'last_7d'
          and pl.last_attended_at >= now() - interval '7 days'
        )
        or (
          ${query.lastAttended ?? null} = 'last_30d'
          and pl.last_attended_at >= now() - interval '30 days'
        )
        or (
          ${query.lastAttended ?? null} = 'not_in_30d'
          and (pl.last_attended_at is null or pl.last_attended_at < now() - interval '30 days')
        )
      )
      order by
        case when ${sortBy} = 'attendance_rate' and ${sortDir} = 'asc'
          then case when pl.registered_count = 0 then null
            else (pl.attended_count::float / pl.registered_count::float) end end asc nulls last,
        case when ${sortBy} = 'attendance_rate' and ${sortDir} = 'desc'
          then case when pl.registered_count = 0 then null
            else (pl.attended_count::float / pl.registered_count::float) end end desc nulls last,
        case when ${sortBy} = 'sessions_attended' and ${sortDir} = 'asc' then pl.attended_count end asc,
        case when ${sortBy} = 'sessions_attended' and ${sortDir} = 'desc' then pl.attended_count end desc,
        case when ${sortBy} = 'total_time' and ${sortDir} = 'asc' then pl.total_time_seconds end asc,
        case when ${sortBy} = 'total_time' and ${sortDir} = 'desc' then pl.total_time_seconds end desc,
        case when ${sortBy} = 'last_attended' and ${sortDir} = 'asc' then pl.last_attended_at end asc nulls last,
        case when ${sortBy} = 'last_attended' and ${sortDir} = 'desc' then pl.last_attended_at end desc nulls last,
        case when ${sortBy} = 'registered_count' and ${sortDir} = 'asc' then pl.registered_count end asc,
        case when ${sortBy} = 'registered_count' and ${sortDir} = 'desc' then pl.registered_count end desc,
        case when ${sortBy} = 'learner_name' and ${sortDir} = 'asc'
          then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end asc nulls last,
        case when ${sortBy} = 'learner_name' and ${sortDir} = 'desc'
          then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end desc nulls last,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const recentRaw = row["recent_statuses"];
      const recent_statuses = Array.isArray(recentRaw)
        ? recentRaw.map((value) => String(value))
        : [];
      return {
        membership_id: String(row["membership_id"]),
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
        batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
        registered_count: Number(row["registered_count"] ?? 0),
        attended_count: Number(row["attended_count"] ?? 0),
        absent_count: Number(row["absent_count"] ?? 0),
        attendance_rate_pct:
          row["attendance_rate_pct"] == null ? null : Number(row["attendance_rate_pct"]),
        total_time_seconds: Number(row["total_time_seconds"] ?? 0),
        avg_coverage_pct: row["avg_coverage_pct"] == null ? null : Number(row["avg_coverage_pct"]),
        last_attended_at: row["last_attended_at"] instanceof Date ? row["last_attended_at"] : null,
        last_attended_session_id:
          typeof row["last_attended_session_id"] === "string"
            ? row["last_attended_session_id"]
            : null,
        last_attended_session_title:
          typeof row["last_attended_session_title"] === "string"
            ? row["last_attended_session_title"]
            : null,
        recent_statuses,
      };
    });
  },

  async listLearnersMatrix(
    tx: TenantTx,
    query: {
      q?: string | undefined;
      courseId?: string | undefined;
      batchId?: string | undefined;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
      attendanceRateBand?: string | undefined;
      sessionsRegisteredBand?: string | undefined;
      lastAttended?: string | undefined;
      learnerLimit: number;
      sessionLimit: number;
    },
  ): Promise<{
    sessions: Array<{
      session_id: string;
      title: string;
      scheduled_at: Date | null;
      turnout_rate_pct: number | null;
    }>;
    learners: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      attendance_rate_pct: number | null;
      attended_count: number;
      registered_count: number;
    }>;
    cells: Array<{
      membership_id: string;
      session_id: string;
      cell: "attended" | "absent" | "registered" | "not_registered";
      attendee_id: string | null;
    }>;
  }> {
    const sessionRows = await tx.$queryRaw<
      Array<{
        session_id: string;
        title: string;
        scheduled_at: Date | null;
        turnout_rate_pct: number | null;
      }>
    >`
      select
        ls.id::text as session_id,
        ls.title,
        coalesce(ls.scheduled_at, ls.started_at) as scheduled_at,
        case
          when count(la.id) = 0 then null
          else round((
            count(*) filter (where la.status = 'attended' or la.joined_at is not null)::float
            / count(la.id)::float
          ) * 1000) / 10.0
        end as turnout_rate_pct
      from live_sessions ls
      left join live_attendance la
        on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
        and (${query.courseId ?? null}::uuid is null or ls.course_id = ${query.courseId ?? null}::uuid)
        and (${query.batchId ?? null}::uuid is null or ls.batch_id = ${query.batchId ?? null}::uuid)
        and (
          ${query.scheduledFrom ?? null}::timestamptz is null
          or coalesce(ls.scheduled_at, ls.started_at) >= ${query.scheduledFrom ?? null}::timestamptz
        )
        and (
          ${query.scheduledTo ?? null}::timestamptz is null
          or coalesce(ls.scheduled_at, ls.started_at) <= ${query.scheduledTo ?? null}::timestamptz
        )
      group by ls.id, ls.title, coalesce(ls.scheduled_at, ls.started_at)
      order by coalesce(ls.scheduled_at, ls.started_at) asc nulls last
      limit ${query.sessionLimit}
    `;

    const learnerRows = await this.listLearnersRollup(tx, {
      ...pickDefinedLearnerFilter(query),
      sortBy: "attendance_rate",
      sortDir: "asc",
      limit: query.learnerLimit,
      page: 1,
    });

    const sessionIds = sessionRows.map((row) => row.session_id);
    const membershipIds = learnerRows.map((row) => row.membership_id);

    let cells: Array<{
      membership_id: string;
      session_id: string;
      cell: "attended" | "absent" | "registered" | "not_registered";
      attendee_id: string | null;
    }> = [];

    if (sessionIds.length > 0 && membershipIds.length > 0) {
      const cellRows = await tx.$queryRaw<
        Array<{
          membership_id: string;
          session_id: string;
          attendee_id: string | null;
          status: string | null;
          joined_at: Date | null;
        }>
      >`
        select
          m.id::text as membership_id,
          s.id::text as session_id,
          la.id::text as attendee_id,
          la.status,
          la.joined_at
        from unnest(${membershipIds}::uuid[]) as m(id)
        cross join unnest(${sessionIds}::uuid[]) as s(id)
        left join live_attendance la
          on la.membership_id = m.id
          and la.live_session_id = s.id
          and la.tenant_id = current_setting('app.tenant_id', true)::uuid
      `;

      cells = cellRows.map((row) => {
        let cell: "attended" | "absent" | "registered" | "not_registered" = "not_registered";
        if (row.attendee_id) {
          if (row.status === "attended" || row.joined_at) cell = "attended";
          else if (row.status === "absent") cell = "absent";
          else cell = "registered";
        }
        return {
          membership_id: row.membership_id,
          session_id: row.session_id,
          cell,
          attendee_id: row.attendee_id,
        };
      });
    }

    return {
      sessions: sessionRows.map((row) => ({
        session_id: row.session_id,
        title: row.title,
        scheduled_at: row.scheduled_at instanceof Date ? row.scheduled_at : null,
        turnout_rate_pct: row.turnout_rate_pct == null ? null : row.turnout_rate_pct,
      })),
      learners: learnerRows.map((row) => ({
        membership_id: row.membership_id,
        learner_name: row.learner_name,
        email: row.email,
        attendance_rate_pct: row.attendance_rate_pct,
        attended_count: row.attended_count,
        registered_count: row.registered_count,
      })),
      cells,
    };
  },

  async listLowAttendanceMembershipIds(
    tx: TenantTx,
    filter: {
      q?: string;
      courseId?: string;
      batchId?: string;
      scheduledFrom?: string;
      scheduledTo?: string;
      limit?: number;
    },
  ): Promise<string[]> {
    const base = pickDefinedLearnerFilter(filter);
    const rows = await this.listLearnersRollup(tx, {
      ...base,
      attendanceRateBand: "below_40",
      sortBy: "attendance_rate",
      sortDir: "asc",
      limit: filter.limit ?? 200,
      page: 1,
    });
    const neverRows = await this.listLearnersRollup(tx, {
      ...base,
      attendanceRateBand: "never_attended",
      sortBy: "registered_count",
      sortDir: "desc",
      limit: filter.limit ?? 200,
      page: 1,
    });
    const ids = new Set<string>();
    for (const row of [...neverRows, ...rows]) ids.add(row.membership_id);
    return [...ids].slice(0, filter.limit ?? 200);
  },

  async findLearnerIdentity(
    tx: TenantTx,
    membershipId: string,
  ): Promise<{
    membership_id: string;
    learner_name: string | null;
    email: string | null;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        m.id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
        and m.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      membership_id: String(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
    };
  },

  async listLearnerDetailSessions(
    tx: TenantTx,
    args: {
      membershipId: string;
      courseId?: string | undefined;
      batchId?: string | undefined;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<
    Array<{
      session_id: string;
      attendee_id: string | null;
      title: string;
      course_id: string | null;
      course_title: string | null;
      batch_id: string | null;
      batch_name: string | null;
      scheduled_at: Date | null;
      started_at: Date | null;
      ended_at: Date | null;
      session_duration_seconds: number | null;
      status: string;
      joined_at: Date | null;
      left_at: Date | null;
      duration_seconds: number | null;
      cohort_avg_duration_seconds: number | null;
      cohort_avg_join_delay_minutes: number | null;
      cohort_avg_leave_early_minutes: number | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          ls.title,
          ls.course_id,
          ls.batch_id,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          case
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
            else null
          end as session_duration_seconds
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and (${args.courseId ?? null}::uuid is null or ls.course_id = ${args.courseId ?? null}::uuid)
          and (${args.batchId ?? null}::uuid is null or ls.batch_id = ${args.batchId ?? null}::uuid)
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      learner_rows as (
        select
          ss.id as session_id,
          la.id as attendee_id,
          ss.title,
          ss.course_id,
          ss.batch_id,
          ss.scheduled_at,
          ss.started_at,
          ss.ended_at,
          ss.session_duration_seconds,
          coalesce(la.status, 'registered') as status,
          la.joined_at,
          la.left_at,
          la.duration_seconds
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and la.membership_id = ${args.membershipId}::uuid
      ),
      cohort as (
        select
          la.live_session_id as session_id,
          avg(la.duration_seconds) filter (
            where la.duration_seconds is not null
              and (la.status = 'attended' or la.joined_at is not null)
          ) as avg_duration_seconds,
          avg(
            case
              when ss.started_at is not null and la.joined_at is not null
                then greatest(0, extract(epoch from (la.joined_at - ss.started_at)) / 60.0)
              else null
            end
          ) as avg_join_delay_minutes,
          avg(
            case
              when ss.ended_at is not null and la.left_at is not null
                then greatest(0, extract(epoch from (ss.ended_at - la.left_at)) / 60.0)
              else null
            end
          ) as avg_leave_early_minutes
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.live_session_id
      )
      select
        lr.session_id::text as session_id,
        lr.attendee_id::text as attendee_id,
        lr.title,
        lr.course_id::text as course_id,
        c.title as course_title,
        lr.batch_id::text as batch_id,
        b.name as batch_name,
        lr.scheduled_at,
        lr.started_at,
        lr.ended_at,
        lr.session_duration_seconds,
        lr.status,
        lr.joined_at,
        lr.left_at,
        lr.duration_seconds,
        case when co.avg_duration_seconds is null then null
          else round(co.avg_duration_seconds::numeric)::int end as cohort_avg_duration_seconds,
        case when co.avg_join_delay_minutes is null then null
          else round(co.avg_join_delay_minutes::numeric, 1)::float end as cohort_avg_join_delay_minutes,
        case when co.avg_leave_early_minutes is null then null
          else round(co.avg_leave_early_minutes::numeric, 1)::float end as cohort_avg_leave_early_minutes
      from learner_rows lr
      left join courses c on c.id = lr.course_id and c.tenant_id = current_setting('app.tenant_id', true)::uuid
      left join batches b on b.id = lr.batch_id and b.tenant_id = current_setting('app.tenant_id', true)::uuid
      left join cohort co on co.session_id = lr.session_id
      order by coalesce(lr.scheduled_at, lr.started_at) desc nulls last
    `;

    return rows.map((row) => ({
      session_id: String(row["session_id"]),
      attendee_id: typeof row["attendee_id"] === "string" ? row["attendee_id"] : null,
      title: String(row["title"]),
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
      course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      session_duration_seconds:
        row["session_duration_seconds"] == null ? null : Number(row["session_duration_seconds"]),
      status: String(row["status"]),
      joined_at: row["joined_at"] instanceof Date ? row["joined_at"] : null,
      left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      cohort_avg_duration_seconds:
        row["cohort_avg_duration_seconds"] == null
          ? null
          : Number(row["cohort_avg_duration_seconds"]),
      cohort_avg_join_delay_minutes:
        row["cohort_avg_join_delay_minutes"] == null
          ? null
          : Number(row["cohort_avg_join_delay_minutes"]),
      cohort_avg_leave_early_minutes:
        row["cohort_avg_leave_early_minutes"] == null
          ? null
          : Number(row["cohort_avg_leave_early_minutes"]),
    }));
  },

  async summarizeCohortAttendanceRate(
    tx: TenantTx,
    args: {
      batchId?: string | null;
      courseId?: string | null;
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<Array<{ avg_rate: number | null }>>`
      with scoped as (
        select ls.id, ls.batch_id, ls.course_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and (
            ${args.batchId ?? null}::uuid is null
            or ls.batch_id = ${args.batchId ?? null}::uuid
          )
          and (
            ${args.courseId ?? null}::uuid is null
            or ls.course_id = ${args.courseId ?? null}::uuid
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          la.membership_id,
          count(*)::float as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::float
            as attended_count
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.membership_id
        having count(*) > 0
      )
      select
        case when count(*) = 0 then null
          else round(avg((attended_count / registered_count) * 100.0)::numeric, 1)::float
        end as avg_rate
      from per_learner
    `;
    const value = rows[0]?.avg_rate;
    return value == null ? null : value;
  },

  async listCohortMonthlyAttendanceRates(
    tx: TenantTx,
    args: {
      batchId?: string | null;
      courseId?: string | null;
      monthKeys: string[];
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<Array<{ month_key: string; avg_rate: number | null }>> {
    if (args.monthKeys.length === 0) return [];
    const rows = await tx.$queryRaw<Array<{ month_key: string; avg_rate: number | null }>>`
      with scoped as (
        select
          ls.id,
          to_char(date_trunc('month', coalesce(ls.scheduled_at, ls.started_at)), 'YYYY-MM')
            as month_key
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status in ('scheduled', 'live', 'ended', 'in_progress', 'completed')
          and coalesce(ls.scheduled_at, ls.started_at) is not null
          and (
            ${args.batchId ?? null}::uuid is null
            or ls.batch_id = ${args.batchId ?? null}::uuid
          )
          and (
            ${args.courseId ?? null}::uuid is null
            or ls.course_id = ${args.courseId ?? null}::uuid
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner_month as (
        select
          ss.month_key,
          la.membership_id,
          count(*)::float as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::float
            as attended_count
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ss.month_key = any(${args.monthKeys}::text[])
        group by ss.month_key, la.membership_id
        having count(*) > 0
      )
      select
        month_key,
        round(avg((attended_count / registered_count) * 100.0)::numeric, 1)::float as avg_rate
      from per_learner_month
      group by month_key
      order by month_key asc
    `;
    return rows.map((row) => ({
      month_key: row.month_key,
      avg_rate: row.avg_rate == null ? null : row.avg_rate,
    }));
  },

  async listSeriesSessionStats(
    tx: TenantTx,
    args: {
      groupBy: "course" | "batch";
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<
    Array<{
      series_id: string;
      series_title: string;
      secondary_id: string | null;
      secondary_title: string | null;
      session_id: string;
      session_title: string;
      status: string;
      scheduled_at: Date | null;
      registered_count: number;
      attended_count: number;
      avg_coverage_pct: number | null;
    }>
  > {
    const byCourse = args.groupBy === "course";
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          ls.title,
          ls.status,
          ls.course_id,
          ls.batch_id,
          coalesce(ls.scheduled_at, ls.started_at) as scheduled_at,
          ls.started_at,
          ls.ended_at,
          case
            when ${byCourse} then ls.course_id
            else ls.batch_id
          end as series_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
          and (
            (${byCourse} and ls.course_id is not null)
            or (not ${byCourse} and ls.batch_id is not null)
          )
      ),
      attendance_agg as (
        select
          la.live_session_id,
          count(*)::int as registered_count,
          count(*) filter (where la.status = 'attended' or la.joined_at is not null)::int
            as attended_count,
          avg(
            case
              when la.duration_seconds is null then null
              when ss.started_at is not null and ss.ended_at is not null
                and extract(epoch from (ss.ended_at - ss.started_at)) > 0
                then least(
                  100.0,
                  (la.duration_seconds::float / extract(epoch from (ss.ended_at - ss.started_at))) * 100.0
                )
              else null
            end
          ) as avg_coverage_pct
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by la.live_session_id
      )
      select
        ss.series_id::text as series_id,
        case
          when ${byCourse} then coalesce(c.title, 'Untitled course')
          else coalesce(b.name, 'Untitled batch')
        end as series_title,
        case
          when ${byCourse} then ss.batch_id::text
          else ss.course_id::text
        end as secondary_id,
        case
          when ${byCourse} then b.name
          else c.title
        end as secondary_title,
        ss.id::text as session_id,
        ss.title as session_title,
        ss.status,
        ss.scheduled_at,
        coalesce(aa.registered_count, 0)::int as registered_count,
        coalesce(aa.attended_count, 0)::int as attended_count,
        case when aa.avg_coverage_pct is null then null
          else round(aa.avg_coverage_pct::numeric, 1)::float end as avg_coverage_pct
      from scoped ss
      left join attendance_agg aa on aa.live_session_id = ss.id
      left join courses c on c.id = ss.course_id and c.tenant_id = current_setting('app.tenant_id', true)::uuid
      left join batches b on b.id = ss.batch_id and b.tenant_id = current_setting('app.tenant_id', true)::uuid
      where ss.series_id is not null
      order by ss.series_id, ss.scheduled_at asc nulls last, ss.id asc
    `;

    return rows.map((row) => ({
      series_id: String(row["series_id"]),
      series_title: typeof row["series_title"] === "string" ? row["series_title"] : "Untitled",
      secondary_id: typeof row["secondary_id"] === "string" ? row["secondary_id"] : null,
      secondary_title: typeof row["secondary_title"] === "string" ? row["secondary_title"] : null,
      session_id: String(row["session_id"]),
      session_title: String(row["session_title"]),
      status: String(row["status"]),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      registered_count: Number(row["registered_count"] ?? 0),
      attended_count: Number(row["attended_count"] ?? 0),
      avg_coverage_pct: row["avg_coverage_pct"] == null ? null : Number(row["avg_coverage_pct"]),
    }));
  },

  async listSeriesNeverAttendingCounts(
    tx: TenantTx,
    args: {
      groupBy: "course" | "batch";
      seriesIds: string[];
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
    },
  ): Promise<Array<{ series_id: string; never_count: number }>> {
    if (args.seriesIds.length === 0) return [];
    const byCourse = args.groupBy === "course";
    const rows = await tx.$queryRaw<Array<{ series_id: string; never_count: number }>>`
      with scoped as (
        select
          ls.id,
          case when ${byCourse} then ls.course_id else ls.batch_id end as series_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (${byCourse} and ls.course_id = any(${args.seriesIds}::uuid[]))
            or (not ${byCourse} and ls.batch_id = any(${args.seriesIds}::uuid[]))
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      ),
      per_learner as (
        select
          ss.series_id,
          la.membership_id,
          bool_or(la.status = 'attended' or la.joined_at is not null) as ever_attended
        from live_attendance la
        join scoped ss on ss.id = la.live_session_id
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by ss.series_id, la.membership_id
      )
      select
        series_id::text as series_id,
        count(*) filter (where not ever_attended)::int as never_count
      from per_learner
      group by series_id
    `;
    return rows.map((row) => ({
      series_id: row.series_id,
      never_count: row.never_count,
    }));
  },

  async listSeriesDropOffMembershipAttendance(
    tx: TenantTx,
    args: {
      groupBy: "course" | "batch";
      scheduledFrom?: string | undefined;
      scheduledTo?: string | undefined;
      maxOrdinal?: number;
    },
  ): Promise<
    Array<{
      series_id: string;
      session_id: string;
      scheduled_at: Date | null;
      membership_id: string;
      attended: boolean;
    }>
  > {
    const byCourse = args.groupBy === "course";
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          coalesce(ls.scheduled_at, ls.started_at) as scheduled_at,
          case when ${byCourse} then ls.course_id else ls.batch_id end as series_id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status not in ('cancelled', 'canceled')
          and (
            (${byCourse} and ls.course_id is not null)
            or (not ${byCourse} and ls.batch_id is not null)
          )
          and (
            ${args.scheduledFrom ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) >= ${args.scheduledFrom ?? null}::timestamptz
          )
          and (
            ${args.scheduledTo ?? null}::timestamptz is null
            or coalesce(ls.scheduled_at, ls.started_at) <= ${args.scheduledTo ?? null}::timestamptz
          )
      )
      select
        ss.series_id::text as series_id,
        ss.id::text as session_id,
        ss.scheduled_at,
        la.membership_id::text as membership_id,
        (la.status = 'attended' or la.joined_at is not null) as attended
      from live_attendance la
      join scoped ss on ss.id = la.live_session_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by ss.series_id, ss.scheduled_at asc nulls last, ss.id asc
    `;
    return rows.map((row) => ({
      series_id: String(row["series_id"]),
      session_id: String(row["session_id"]),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      membership_id: String(row["membership_id"]),
      attended: Boolean(row["attended"]),
    }));
  },
};
