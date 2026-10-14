import type { TenantTx } from "@atlas/db";
import type { LiveAttendeesQuery } from "./live-class-attendance-roster.dto";
import type {
  LiveAttendeeRow,
  LiveAttendeesFilter,
} from "./live-class-attendance-roster.repository";

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

/**
 * A session's attendees, one attendee, and the live monitor roster.
 * Part of liveClassAttendanceRosterRepository.
 */
export const liveClassAttendanceRosterAttendeesRepository = {
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
};
