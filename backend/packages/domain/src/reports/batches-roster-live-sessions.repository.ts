import type { TenantTx } from "@atlas/db";
import type {
  BatchLiveSessionAttendeeRow,
  BatchLiveSessionDetailRow,
  BatchLiveSessionIntervalRow,
  BatchLiveSessionRow,
  BatchLiveSessionsSummaryRow,
} from "./batches-roster.repository";
import { asUnknownString } from "./batches-roster.repository-helpers";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

/**
 * A batch's live sessions: the list, matrix, one session and its attendees.
 * Part of batchesRosterRepository.
 */
export const batchesRosterLiveSessionsRepository = {
  async countBatchLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: {
      q?: string;
      status: "any" | "upcoming" | "completed" | "cancelled" | "live";
    },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.status} = 'any'
          or (
            ${query.status} = 'upcoming'
            and (
              lower(ls.status) in ('scheduled', 'upcoming')
              or (
                ls.scheduled_at is not null
                and ls.scheduled_at >= now()
                and ls.ended_at is null
                and lower(ls.status) not in ('cancelled', 'canceled', 'ended', 'completed')
              )
            )
          )
          or (
            ${query.status} = 'completed'
            and (
              lower(ls.status) in ('ended', 'completed')
              or ls.ended_at is not null
              or (
                ls.scheduled_at is not null
                and ls.scheduled_at < now()
                and lower(ls.status) not in ('cancelled', 'canceled', 'scheduled', 'upcoming', 'live', 'in_progress')
              )
            )
          )
          or (
            ${query.status} = 'cancelled'
            and lower(ls.status) in ('cancelled', 'canceled')
          )
          or (
            ${query.status} = 'live'
            and lower(ls.status) in ('live', 'in_progress')
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listBatchLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: {
      q?: string;
      status: "any" | "upcoming" | "completed" | "cancelled" | "live";
      sortBy: "scheduled_at" | "title" | "attendance_rate";
      sortDir: "asc" | "desc";
      page: number;
      limit: number;
      rosterCount: number;
    },
  ): Promise<BatchLiveSessionRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const rosterCount = query.rosterCount;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with scoped as (
        select
          ls.id,
          ls.title,
          ls.status,
          ls.scheduled_at,
          ls.started_at,
          ls.ended_at,
          ls.created_at,
          ls.metadata_json,
          coalesce(ls.metadata_json->>'kind', ls.metadata_json->>'type', null) as session_kind,
          coalesce(
            nullif(ls.metadata_json->>'host', ''),
            nullif(ls.metadata_json->>'hostName', ''),
            nullif(ls.metadata_json->>'host_label', ''),
            nullif(ls.metadata_json->>'instructor', ''),
            null
          ) as host_label,
          coalesce(
            nullif(ls.metadata_json->>'recordingUrl', ''),
            nullif(ls.metadata_json->>'recording_url', ''),
            nullif(ls.metadata_json->>'recording', ''),
            null
          ) as recording_url,
          case
            when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'durationMinutes')::int
            when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'duration_minutes')::int
            else null
          end as planned_duration_minutes,
          case
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
            else null
          end as actual_duration_minutes,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
          ) as attended_count,
          (
            select coalesce(avg(la.duration_seconds), 0)::float
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
              and la.duration_seconds is not null
          ) as avg_duration_seconds,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and la.joined_at is not null
              and ls.scheduled_at is not null
              and la.joined_at > ls.scheduled_at + interval '5 minutes'
          ) as late_count
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
          and (
            ${query.q ?? null}::text is null
            or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.status} = 'any'
            or (
              ${query.status} = 'upcoming'
              and (
                lower(ls.status) in ('scheduled', 'upcoming')
                or (
                  ls.scheduled_at is not null
                  and ls.scheduled_at >= now()
                  and ls.ended_at is null
                  and lower(ls.status) not in ('cancelled', 'canceled', 'ended', 'completed')
                )
              )
            )
            or (
              ${query.status} = 'completed'
              and (
                lower(ls.status) in ('ended', 'completed')
                or ls.ended_at is not null
                or (
                  ls.scheduled_at is not null
                  and ls.scheduled_at < now()
                  and lower(ls.status) not in ('cancelled', 'canceled', 'scheduled', 'upcoming', 'live', 'in_progress')
                )
              )
            )
            or (
              ${query.status} = 'cancelled'
              and lower(ls.status) in ('cancelled', 'canceled')
            )
            or (
              ${query.status} = 'live'
              and lower(ls.status) in ('live', 'in_progress')
            )
          )
      )
      select
        id::text as id,
        title,
        status,
        session_kind,
        host_label,
        scheduled_at,
        started_at,
        ended_at,
        planned_duration_minutes,
        actual_duration_minutes,
        ${rosterCount}::int as roster_count,
        attended_count,
        case
          when ${rosterCount}::int > 0
            and (
              lower(status) in ('ended', 'completed', 'live', 'in_progress')
              or ended_at is not null
              or (scheduled_at is not null and scheduled_at < now())
            )
            and lower(status) not in ('cancelled', 'canceled')
          then round((attended_count::numeric / ${rosterCount}::numeric) * 100, 1)::float
          else null
        end as attendance_rate_pct,
        case
          when avg_duration_seconds > 0
          then round((avg_duration_seconds / 60.0)::numeric, 1)::float
          else null
        end as avg_watch_minutes,
        late_count,
        recording_url
      from scoped
      order by
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then title end asc nulls last,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then title end desc nulls last,
        case
          when ${sortBy} = 'attendance_rate' and ${sortDir} = 'asc'
          then case
            when ${rosterCount}::int > 0 then (attended_count::numeric / ${rosterCount}::numeric)
            else null
          end
        end asc nulls last,
        case
          when ${sortBy} = 'attendance_rate' and ${sortDir} = 'desc'
          then case
            when ${rosterCount}::int > 0 then (attended_count::numeric / ${rosterCount}::numeric)
            else null
          end
        end desc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'asc' then coalesce(scheduled_at, created_at) end asc nulls last,
        case when ${sortBy} = 'scheduled_at' and ${sortDir} = 'desc' then coalesce(scheduled_at, created_at) end desc nulls last,
        coalesce(scheduled_at, created_at) desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const recordingUrl =
        typeof row["recording_url"] === "string" && row["recording_url"].length > 0
          ? row["recording_url"]
          : null;
      return {
        id: asUnknownString(row["id"]),
        title: asUnknownString(row["title"], "Live session"),
        kind: typeof row["session_kind"] === "string" ? row["session_kind"] : null,
        status: asUnknownString(row["status"], "scheduled"),
        host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
        scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
        started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
        ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
        planned_duration_minutes:
          row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
        actual_duration_minutes:
          row["actual_duration_minutes"] == null ? null : Number(row["actual_duration_minutes"]),
        roster_count: Number(row["roster_count"] ?? rosterCount),
        attended_count: Number(row["attended_count"] ?? 0),
        attendance_rate_pct:
          row["attendance_rate_pct"] == null ? null : Number(row["attendance_rate_pct"]),
        avg_watch_minutes:
          row["avg_watch_minutes"] == null ? null : Number(row["avg_watch_minutes"]),
        late_count: Number(row["late_count"] ?? 0),
        recording_url: recordingUrl,
        has_recording: recordingUrl != null,
      };
    });
  },

  async summarizeBatchLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
  ): Promise<BatchLiveSessionsSummaryRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          ls.id,
          ls.status,
          ls.scheduled_at,
          ls.ended_at,
          ls.started_at,
          case
            when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'durationMinutes')::int
            when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
              then (ls.metadata_json->>'duration_minutes')::int
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
            else null
          end as planned_minutes,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
          ) as attended_count,
          (
            select avg(la.duration_seconds)::float
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and lower(la.status) in ('attended', 'present', 'joined', 'partial')
              and la.duration_seconds is not null
          ) as avg_duration_seconds
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
      ),
      held as (
        select *
        from sessions
        where lower(status) not in ('cancelled', 'canceled')
          and (
            lower(status) in ('ended', 'completed', 'live', 'in_progress')
            or ended_at is not null
            or started_at is not null
            or (scheduled_at is not null and scheduled_at < now())
          )
      ),
      member_misses as (
        select
          bm.membership_id,
          count(*) filter (
            where not exists (
              select 1
              from live_attendance la
              where la.live_session_id = h.id
                and la.tenant_id = current_setting('app.tenant_id', true)::uuid
                and la.membership_id = bm.membership_id
                and lower(la.status) in ('attended', 'present', 'joined', 'partial')
            )
          )::int as missed_count,
          count(*)::int as held_count
        from batch_memberships bm
        cross join held h
        where bm.batch_id = ${batchId}::uuid
        group by bm.membership_id
      )
      select
        (select count(*)::int from sessions) as sessions_total_count,
        (select count(*)::int from held) as sessions_held_count,
        case
          when ${rosterCount}::int > 0 and (select count(*) from held) > 0
          then round(
            (
              select avg(attended_count::numeric / nullif(${rosterCount}::numeric, 0) * 100)
              from held
            )::numeric,
            1
          )::float
          else null
        end as avg_attendance_pct,
        (
          select count(*)::int
          from member_misses
          where held_count > 0 and missed_count = 0
        ) as perfect_attendance_count,
        (
          select count(*)::int
          from member_misses
          where missed_count >= 3
        ) as missed_three_or_more_count,
        (
          select round((avg(avg_duration_seconds) / 60.0)::numeric, 1)::float
          from held
          where avg_duration_seconds is not null
        ) as avg_watch_minutes,
        (
          select round(avg(planned_minutes)::numeric, 0)::int
          from held
          where planned_minutes is not null
        ) as planned_watch_minutes
    `;

    const row = rows[0] ?? {};
    return {
      avg_attendance_pct:
        row["avg_attendance_pct"] == null ? null : Number(row["avg_attendance_pct"]),
      sessions_held_count: Number(row["sessions_held_count"] ?? 0),
      sessions_total_count: Number(row["sessions_total_count"] ?? 0),
      perfect_attendance_count: Number(row["perfect_attendance_count"] ?? 0),
      missed_three_or_more_count: Number(row["missed_three_or_more_count"] ?? 0),
      avg_watch_minutes: row["avg_watch_minutes"] == null ? null : Number(row["avg_watch_minutes"]),
      planned_watch_minutes:
        row["planned_watch_minutes"] == null ? null : Number(row["planned_watch_minutes"]),
      roster_count: rosterCount,
    };
  },

  async listBatchLiveSessionsMatrix(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: { q?: string; limitLearners: number; limitSessions: number },
  ): Promise<{
    sessions: Array<{
      id: string;
      title: string;
      scheduled_at: Date | null;
      status: string;
    }>;
    learners: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      cells: Array<{
        live_session_id: string;
        kind: "attended" | "partial" | "absent" | "upcoming" | "cancelled" | "none";
      }>;
      attended_count: number;
      missed_count: number;
    }>;
  }> {
    const sessionRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.scheduled_at,
        ls.status,
        ls.ended_at,
        ls.started_at
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
        )
      order by coalesce(ls.scheduled_at, ls.created_at) asc
      limit ${query.limitSessions}
    `;

    const sessions = sessionRows.map((row) => ({
      id: asUnknownString(row["id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      status: asUnknownString(row["status"], "scheduled"),
    }));

    if (sessions.length === 0) {
      return { sessions: [], learners: [] };
    }

    const sessionIds = sessions.map((s) => s.id);

    const learnerRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.batch_id = ${batchId}::uuid
      order by lower(coalesce(
        mp.display_name,
        ap.email,
        m.invited_email_normalized,
        bm.membership_id::text
      )) asc
      limit ${query.limitLearners}
    `;

    const attendanceRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        la.live_session_id::text as live_session_id,
        lower(la.status) as status,
        la.duration_seconds
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = any(${sessionIds}::uuid[])
    `;

    const attendanceByMember = new Map<
      string,
      Map<string, { status: string; duration: number | null }>
    >();
    for (const row of attendanceRows) {
      const membershipId = asUnknownString(row["membership_id"]);
      const sessionId = asUnknownString(row["live_session_id"]);
      const bucket =
        attendanceByMember.get(membershipId) ??
        new Map<string, { status: string; duration: number | null }>();
      bucket.set(sessionId, {
        status: asUnknownString(row["status"], ""),
        duration: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      });
      attendanceByMember.set(membershipId, bucket);
    }

    const now = Date.now();
    const learners = learnerRows.map((row) => {
      const membershipId = asUnknownString(row["membership_id"]);
      const memberAttendance =
        attendanceByMember.get(membershipId) ??
        new Map<string, { status: string; duration: number | null }>();
      let attendedCount = 0;
      let missedCount = 0;
      const cells = sessions.map((session) => {
        const statusLower = session.status.toLowerCase();
        const isCancelled = statusLower === "cancelled" || statusLower === "canceled";
        const isUpcoming =
          !isCancelled &&
          (statusLower === "scheduled" ||
            statusLower === "upcoming" ||
            (session.scheduled_at != null &&
              session.scheduled_at.getTime() >= now &&
              statusLower !== "ended" &&
              statusLower !== "completed"));

        if (isCancelled) {
          return { live_session_id: session.id, kind: "cancelled" as const };
        }
        if (isUpcoming) {
          return { live_session_id: session.id, kind: "upcoming" as const };
        }

        const attendance = memberAttendance.get(session.id);
        if (!attendance) {
          missedCount += 1;
          return { live_session_id: session.id, kind: "absent" as const };
        }
        if (attendance.status === "partial") {
          attendedCount += 1;
          return { live_session_id: session.id, kind: "partial" as const };
        }
        if (["attended", "present", "joined"].includes(attendance.status)) {
          attendedCount += 1;
          return { live_session_id: session.id, kind: "attended" as const };
        }
        if (["absent", "missed", "no_show"].includes(attendance.status)) {
          missedCount += 1;
          return { live_session_id: session.id, kind: "absent" as const };
        }
        missedCount += 1;
        return { live_session_id: session.id, kind: "absent" as const };
      });

      return {
        membership_id: membershipId,
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        cells,
        attended_count: attendedCount,
        missed_count: missedCount,
      };
    });

    return { sessions, learners };
  },

  async listBatchLiveSessionAbsenteeMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    minMissed: number,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with held as (
        select ls.id
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
          and lower(ls.status) not in ('cancelled', 'canceled')
          and (
            lower(ls.status) in ('ended', 'completed', 'live', 'in_progress')
            or ls.ended_at is not null
            or ls.started_at is not null
            or (ls.scheduled_at is not null and ls.scheduled_at < now())
          )
      ),
      member_misses as (
        select
          bm.membership_id,
          count(*) filter (
            where not exists (
              select 1
              from live_attendance la
              where la.live_session_id = h.id
                and la.tenant_id = current_setting('app.tenant_id', true)::uuid
                and la.membership_id = bm.membership_id
                and lower(la.status) in ('attended', 'present', 'joined', 'partial')
            )
          )::int as missed_count
        from batch_memberships bm
        cross join held h
        where bm.batch_id = ${batchId}::uuid
        group by bm.membership_id
      )
      select membership_id::text as membership_id
      from member_misses
      where missed_count >= ${minMissed}
      order by missed_count desc, membership_id
    `;
    return rows.map((row) => row.membership_id);
  },

  async findBatchLiveSession(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    sessionId: string,
  ): Promise<BatchLiveSessionDetailRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.batch_id::text as batch_id,
        ls.course_id::text as course_id,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        coalesce(ls.metadata_json->>'kind', ls.metadata_json->>'type', null) as session_kind,
        coalesce(
          nullif(ls.metadata_json->>'host', ''),
          nullif(ls.metadata_json->>'hostName', ''),
          nullif(ls.metadata_json->>'host_label', ''),
          nullif(ls.metadata_json->>'instructor', ''),
          null
        ) as host_label,
        coalesce(
          nullif(ls.metadata_json->>'recordingUrl', ''),
          nullif(ls.metadata_json->>'recording_url', ''),
          nullif(ls.metadata_json->>'recording', ''),
          null
        ) as recording_url,
        coalesce(
          nullif(ls.metadata_json->>'timezone', ''),
          nullif(ls.metadata_json->>'timezoneLabel', ''),
          null
        ) as timezone_label,
        case
          when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'durationMinutes')::int
          when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'duration_minutes')::int
          else null
        end as planned_duration_minutes,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
          else null
        end as actual_duration_minutes
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id = ${sessionId}::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const recordingUrl =
      typeof row["recording_url"] === "string" && row["recording_url"].length > 0
        ? row["recording_url"]
        : null;
    return {
      id: asUnknownString(row["id"]),
      title: asUnknownString(row["title"], "Live session"),
      kind: typeof row["session_kind"] === "string" ? row["session_kind"] : null,
      status: asUnknownString(row["status"], "scheduled"),
      host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      planned_duration_minutes:
        row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
      actual_duration_minutes:
        row["actual_duration_minutes"] == null ? null : Number(row["actual_duration_minutes"]),
      recording_url: recordingUrl,
      timezone_label: typeof row["timezone_label"] === "string" ? row["timezone_label"] : null,
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
    };
  },

  async findNextBatchLiveSession(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    afterAt: Date | null,
    excludeSessionId: string,
  ): Promise<{ id: string; title: string; scheduled_at: Date | null } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.scheduled_at
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id <> ${excludeSessionId}::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and lower(ls.status) not in ('cancelled', 'canceled')
        and (
          ${afterAt ?? null}::timestamptz is null
          or coalesce(ls.scheduled_at, ls.created_at) > ${afterAt ?? null}::timestamptz
        )
      order by coalesce(ls.scheduled_at, ls.created_at) asc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: asUnknownString(row["id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
    };
  },

  async listBatchLiveSessionIntervals(
    tx: TenantTx,
    sessionId: string,
  ): Promise<BatchLiveSessionIntervalRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        la.joined_at,
        la.left_at,
        la.duration_seconds
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${sessionId}::uuid
        and la.joined_at is not null
        and lower(la.status) in ('attended', 'present', 'joined', 'partial', 'excused')
    `;
    return rows
      .filter((row) => row["joined_at"] instanceof Date)
      .map((row) => ({
        membership_id: asUnknownString(row["membership_id"]),
        joined_at: row["joined_at"] as Date,
        left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
        duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      }));
  },

  async countBatchLiveSessionAttendees(
    tx: TenantTx,
    batchId: string,
    sessionId: string,
    query: {
      q?: string | undefined;
      attendanceKind: "any" | "attended" | "partial" | "absent" | "excused" | "upcoming";
      plannedSeconds: number | null;
      sessionStart: Date | null;
      sessionEnd: Date | null;
      isUpcoming: boolean;
      isCancelled: boolean;
    },
  ): Promise<number> {
    const rows = await this.listBatchLiveSessionAttendeeRows(tx, batchId, sessionId, {
      ...(query.q !== undefined ? { q: query.q } : {}),
      attendanceKind: "any",
      sortBy: "learner_name",
      sortDir: "asc",
      page: 1,
      limit: 5000,
      plannedSeconds: query.plannedSeconds,
      sessionStart: query.sessionStart,
      sessionEnd: query.sessionEnd,
      isUpcoming: query.isUpcoming,
      isCancelled: query.isCancelled,
    });
    if (query.attendanceKind === "any") return rows.length;
    return rows.filter((row) => row.attendance_kind === query.attendanceKind).length;
  },

  async listBatchLiveSessionAttendeeRows(
    tx: TenantTx,
    batchId: string,
    sessionId: string,
    query: {
      q?: string;
      attendanceKind: "any" | "attended" | "partial" | "absent" | "excused" | "upcoming";
      sortBy: "learner_name" | "joined_at" | "left_at" | "watch_pct" | "status" | "rejoins";
      sortDir: "asc" | "desc";
      page: number;
      limit: number;
      plannedSeconds: number | null;
      sessionStart: Date | null;
      sessionEnd: Date | null;
      isUpcoming: boolean;
      isCancelled: boolean;
    },
  ): Promise<
    Array<
      BatchLiveSessionAttendeeRow & {
        attendance_kind: "attended" | "partial" | "absent" | "excused" | "upcoming";
        health_rail: "none" | "warning" | "danger";
        watch_pct: number | null;
        late: boolean;
        left_early: boolean;
      }
    >
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        la.status as raw_status,
        la.joined_at,
        la.left_at,
        la.duration_seconds,
        null::int as rejoins,
        null::text as device_label
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join live_attendance la
        on la.membership_id = bm.membership_id
        and la.live_session_id = ${sessionId}::uuid
        and la.tenant_id = bm.tenant_id
      where bm.batch_id = ${batchId}::uuid
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
    `;

    const ATTENDED_MIN = 0.9;
    const PARTIAL_MIN = 0.1;
    const WARNING_MAX = 0.5;
    const LATE_GRACE_MS = 5 * 60 * 1000;
    const EARLY_LEAVE_MS = 5 * 60 * 1000;

    const mapped = rows.map((row) => {
      const rawStatus =
        typeof row["raw_status"] === "string" ? row["raw_status"].toLowerCase() : null;
      const joinedAt = row["joined_at"] instanceof Date ? row["joined_at"] : null;
      const leftAt = row["left_at"] instanceof Date ? row["left_at"] : null;
      const durationSeconds =
        row["duration_seconds"] == null ? null : Number(row["duration_seconds"]);
      const plannedSeconds = query.plannedSeconds;

      let attendance_kind: "attended" | "partial" | "absent" | "excused" | "upcoming" = "absent";
      if (query.isCancelled) {
        attendance_kind = "absent";
      } else if (query.isUpcoming && !joinedAt && !rawStatus) {
        attendance_kind = "upcoming";
      } else if (rawStatus === "excused") {
        attendance_kind = "excused";
      } else if (rawStatus === "absent" || rawStatus === "missed" || rawStatus === "no_show") {
        attendance_kind = "absent";
      } else if (joinedAt || (durationSeconds != null && durationSeconds > 0)) {
        const watchPct =
          plannedSeconds && plannedSeconds > 0 && durationSeconds != null
            ? durationSeconds / plannedSeconds
            : durationSeconds != null && durationSeconds > 0
              ? 1
              : 0;
        if (watchPct >= ATTENDED_MIN) attendance_kind = "attended";
        else if (watchPct >= PARTIAL_MIN) attendance_kind = "partial";
        else if (rawStatus && ["attended", "present", "joined", "partial"].includes(rawStatus)) {
          attendance_kind = watchPct > 0 ? "partial" : "absent";
        } else {
          attendance_kind = "absent";
        }
      }

      const watchPct =
        plannedSeconds && plannedSeconds > 0 && durationSeconds != null
          ? Math.round((durationSeconds / plannedSeconds) * 1000) / 10
          : null;

      let health_rail: "none" | "warning" | "danger" = "none";
      if (attendance_kind === "absent") health_rail = "danger";
      else if (watchPct != null && watchPct < WARNING_MAX * 100) health_rail = "warning";

      const late =
        Boolean(joinedAt && query.sessionStart) &&
        defined(joinedAt).getTime() > defined(query.sessionStart).getTime() + LATE_GRACE_MS;
      const left_early =
        Boolean(leftAt && query.sessionEnd) &&
        defined(leftAt).getTime() < defined(query.sessionEnd).getTime() - EARLY_LEAVE_MS;

      return {
        membership_id: asUnknownString(row["membership_id"]),
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        raw_status: rawStatus,
        joined_at: joinedAt,
        left_at: leftAt,
        duration_seconds: durationSeconds,
        rejoins: row["rejoins"] == null ? null : Number(row["rejoins"]),
        device_label: typeof row["device_label"] === "string" ? row["device_label"] : null,
        attendance_kind,
        health_rail,
        watch_pct: watchPct,
        late,
        left_early,
      };
    });

    const filtered =
      query.attendanceKind === "any"
        ? mapped
        : mapped.filter((row) => row.attendance_kind === query.attendanceKind);

    const kindOrder: Record<string, number> = {
      absent: 0,
      partial: 1,
      attended: 2,
      excused: 3,
      upcoming: 4,
    };

    filtered.sort((a, b) => {
      const dir = query.sortDir === "asc" ? 1 : -1;
      const cmp = (left: number | string | null, right: number | string | null) => {
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        if (left < right) return -1 * dir;
        if (left > right) return 1 * dir;
        return 0;
      };
      if (query.sortBy === "joined_at") {
        return cmp(a.joined_at?.getTime() ?? null, b.joined_at?.getTime() ?? null);
      }
      if (query.sortBy === "left_at") {
        return cmp(a.left_at?.getTime() ?? null, b.left_at?.getTime() ?? null);
      }
      if (query.sortBy === "watch_pct") {
        return cmp(a.watch_pct, b.watch_pct);
      }
      if (query.sortBy === "rejoins") {
        return cmp(a.rejoins, b.rejoins);
      }
      if (query.sortBy === "status") {
        const byKind = (kindOrder[a.attendance_kind] ?? 9) - (kindOrder[b.attendance_kind] ?? 9);
        if (byKind !== 0) return byKind * dir;
        return cmp(
          (a.learner_name ?? a.email ?? "").toLowerCase(),
          (b.learner_name ?? b.email ?? "").toLowerCase(),
        );
      }
      return cmp(
        (a.learner_name ?? a.email ?? "").toLowerCase(),
        (b.learner_name ?? b.email ?? "").toLowerCase(),
      );
    });

    const skip = (query.page - 1) * query.limit;
    return filtered.slice(skip, skip + query.limit);
  },
};
