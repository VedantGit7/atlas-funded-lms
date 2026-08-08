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
    duration_seconds:
      row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    attendance_count: Number(row["attendance_count"] ?? 0),
    registered_count: Number(row["registered_count"] ?? 0),
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
    duration_seconds:
      row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
  };
}

export const liveClassAttendanceRosterRepository = {
  async countSessions(tx: TenantTx, query: LiveSessionsListQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
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
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listSessions(
    tx: TenantTx,
    query: LiveSessionsListQuery,
  ): Promise<LiveSessionListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

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
        ) as registered_count
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
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then ls.title end asc nulls last,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then ls.title end desc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'asc' then ls.scheduled_at end asc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'desc' then ls.scheduled_at end desc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'asc' then ls.started_at end asc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'desc' then ls.started_at end desc nulls last,
        case
          when ${sortBy} = 'attendance_count' and ${sortDir} = 'asc' then (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          )
        end asc nulls last,
        case
          when ${sortBy} = 'attendance_count' and ${sortDir} = 'desc' then (
            select count(*)::int from live_attendance la
            where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id and la.status = 'attended'
          )
        end desc nulls last,
        case
          when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then
            case
              when ls.started_at is not null and ls.ended_at is not null
                then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
              else 0
            end
        end asc nulls last,
        case
          when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then
            case
              when ls.started_at is not null and ls.ended_at is not null
                then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
              else 0
            end
        end desc nulls last,
        ls.scheduled_at desc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapSessionRow);
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
        ) as registered_count
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
      totalAttendanceSeconds: Number(row?.total_seconds ?? 0),
      avgDurationSeconds: row?.avg_seconds == null ? null : Number(row.avg_seconds),
    };
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
};
