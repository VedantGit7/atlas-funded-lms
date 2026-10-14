import type { TenantTx } from "@atlas/db";
import { textColumn } from "./raw-column";
import type { PollListRow } from "./polls-roster.repository";
import { mapPollListRow } from "./polls-roster.repository-helpers";

/**
 * Polls by live session: the list, one session, its attendees and responses.
 * Part of pollsRosterRepository.
 */
export const pollsRosterLiveSessionsRepository = {
  async findLiveSessionForPollReport(
    tx: TenantTx,
    liveSessionId: string,
  ): Promise<{
    id: string;
    title: string;
    status: string;
    scheduled_at: Date | null;
    started_at: Date | null;
    ended_at: Date | null;
    host_label: string | null;
    recording_url: string | null;
    timezone_label: string | null;
    planned_duration_minutes: number | null;
    batch_id: string | null;
    batch_name: string | null;
    course_id: string | null;
    course_title: string | null;
    attendance_count: number;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        ls.course_id::text as course_id,
        c.title as course_title,
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
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as attendance_count
      from live_sessions ls
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id = ${liveSessionId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const recordingUrl =
      typeof row["recording_url"] === "string" && row["recording_url"].length > 0
        ? row["recording_url"]
        : null;
    return {
      id: textColumn(row["id"]),
      title: textColumn(row["title"], "Live session"),
      status: textColumn(row["status"], "scheduled"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
      recording_url: recordingUrl,
      timezone_label: typeof row["timezone_label"] === "string" ? row["timezone_label"] : null,
      planned_duration_minutes:
        row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
      course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
      attendance_count: Number(row["attendance_count"] ?? 0),
    };
  },

  async listPollsForLiveSession(tx: TenantTx, liveSessionId: string): Promise<PollListRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.title,
        p.description,
        p.poll_type,
        p.status::text as status,
        p.quiz_mode,
        p.allow_multiple_answers,
        p.anonymous_vote,
        p.result_visibility,
        p.layout,
        p.duration_seconds,
        p.live_session_id::text as live_session_id,
        ls.title as live_session_title,
        p.closes_at,
        (
          p.status::text = 'ACTIVE'
          and (p.closes_at is null or p.closes_at > now())
        ) as is_open,
        p.created_at,
        (
          select count(*)::int from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as response_count,
        (
          select count(*)::int from poll_options po
          where po.poll_id = p.id and po.tenant_id = p.tenant_id
        ) as option_count,
        case
          when (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = p.live_session_id
              and la.tenant_id = p.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric
                from poll_responses pr
                where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
              )
              / nullif(
                (
                  select count(*)::numeric
                  from live_attendance la
                  where la.live_session_id = p.live_session_id
                    and la.tenant_id = p.tenant_id
                ),
                0
              )
            ) * 100
          )::float
        end as participation_pct
      from polls p
      left join live_sessions ls
        on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and p.live_session_id = ${liveSessionId}::uuid
      order by p.created_at asc, p.id asc
    `;
    return rows.map(mapPollListRow);
  },

  async listLiveSessionAttendanceIntervals(
    tx: TenantTx,
    liveSessionId: string,
  ): Promise<Array<{ joined_at: Date; left_at: Date | null; duration_seconds: number | null }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.joined_at,
        la.left_at,
        la.duration_seconds
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${liveSessionId}::uuid
        and la.joined_at is not null
    `;
    return rows
      .filter((row) => row["joined_at"] instanceof Date)
      .map((row) => ({
        joined_at: row["joined_at"] as Date,
        left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
        duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      }));
  },

  async listLiveSessionAttendees(
    tx: TenantTx,
    liveSessionId: string,
    limit = 300,
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from live_attendance la
      join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${liveSessionId}::uuid
      order by lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, '')) asc
      limit ${limit}
    `;
    return rows.map((row) => ({
      membership_id: textColumn(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
    }));
  },

  async listLiveSessionPollResponses(
    tx: TenantTx,
    liveSessionId: string,
  ): Promise<
    Array<{
      poll_id: string;
      membership_id: string;
      is_correct: boolean | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        pr.poll_id::text as poll_id,
        pr.membership_id::text as membership_id,
        case
          when p.quiz_mode then po.is_correct
          else null
        end as is_correct
      from poll_responses pr
      join polls p on p.id = pr.poll_id and p.tenant_id = pr.tenant_id
      join poll_options po on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
      where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and p.live_session_id = ${liveSessionId}::uuid
        and p.anonymous_vote = false
    `;
    return rows.map((row) => ({
      poll_id: textColumn(row["poll_id"]),
      membership_id: textColumn(row["membership_id"]),
      is_correct: row["is_correct"] == null ? null : Boolean(row["is_correct"]),
    }));
  },

  async countAnsweredEveryTrackedPoll(tx: TenantTx, liveSessionId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with tracked_polls as (
        select p.id
        from polls p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.live_session_id = ${liveSessionId}::uuid
          and p.anonymous_vote = false
      ),
      tracked_count as (
        select count(*)::int as n from tracked_polls
      ),
      attendees as (
        select distinct la.membership_id
        from live_attendance la
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and la.live_session_id = ${liveSessionId}::uuid
      ),
      answered as (
        select pr.membership_id, count(distinct pr.poll_id)::int as answered_n
        from poll_responses pr
        join tracked_polls tp on tp.id = pr.poll_id
        where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by pr.membership_id
      )
      select count(*)::bigint as count
      from attendees a
      join answered ans on ans.membership_id = a.membership_id
      cross join tracked_count tc
      where tc.n > 0
        and ans.answered_n >= tc.n
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countLiveSessionsWithPolls(tx: TenantTx, query: { q?: string }): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and exists (
          select 1 from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(ls.metadata_json->>'host', '')) like '%' || lower(${query.q ?? null}) || '%'
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listLiveSessionsWithPolls(
    tx: TenantTx,
    query: { q?: string; page: number; limit: number },
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      scheduled_at: Date | null;
      started_at: Date | null;
      ended_at: Date | null;
      host_label: string | null;
      attendance_count: number;
      poll_count: number;
      quiz_poll_count: number;
      total_responses: number;
      avg_participation_pct: number | null;
      batch_id: string | null;
      batch_name: string | null;
      course_title: string | null;
    }>
  > {
    const offset = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        c.title as course_title,
        coalesce(
          nullif(ls.metadata_json->>'host', ''),
          nullif(ls.metadata_json->>'hostName', ''),
          nullif(ls.metadata_json->>'host_label', ''),
          nullif(ls.metadata_json->>'instructor', ''),
          null
        ) as host_label,
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as attendance_count,
        (
          select count(*)::int from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
        ) as poll_count,
        (
          select count(*)::int from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id and p.quiz_mode = true
        ) as quiz_poll_count,
        (
          select count(*)::int
          from poll_responses pr
          join polls p on p.id = pr.poll_id and p.tenant_id = pr.tenant_id
          where p.live_session_id = ls.id and pr.tenant_id = ls.tenant_id
        ) as total_responses,
        (
          select avg(part.pct)::float
          from (
            select
              case
                when att.n = 0 then null
                else round((resp.n::numeric / att.n::numeric) * 100, 1)::float
              end as pct
            from polls p
            cross join lateral (
              select count(*)::int as n
              from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ) att
            cross join lateral (
              select count(*)::int as n
              from poll_responses pr
              where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
            ) resp
            where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
          ) part
          where part.pct is not null
        ) as avg_participation_pct
      from live_sessions ls
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and exists (
          select 1 from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(ls.metadata_json->>'host', ls.metadata_json->>'hostName', ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
      order by coalesce(ls.started_at, ls.scheduled_at, ls.created_at) desc, ls.id desc
      limit ${query.limit}
      offset ${offset}
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      title: textColumn(row["title"], "Live session"),
      status: textColumn(row["status"], "scheduled"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
      attendance_count: Number(row["attendance_count"] ?? 0),
      poll_count: Number(row["poll_count"] ?? 0),
      quiz_poll_count: Number(row["quiz_poll_count"] ?? 0),
      total_responses: Number(row["total_responses"] ?? 0),
      avg_participation_pct:
        row["avg_participation_pct"] == null ? null : Number(row["avg_participation_pct"]),
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
    }));
  },
};
