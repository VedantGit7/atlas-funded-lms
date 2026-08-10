import type { TenantTx } from "@atlas/db";
import type {
  ZoomMeetingsListQuery,
  ZoomParticipantsQuery,
  ZoomPeopleListQuery,
  ZoomPersonMeetingsQuery,
} from "./zoom-insights-roster.dto";

export type ZoomMeetingListRow = {
  id: string;
  external_meeting_id: string;
  topic: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  attendance_count: number;
  matched_count: number;
  unmatched_count: number;
  total_attendance_seconds: number;
};

export type ZoomParticipantRow = {
  id: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  zoom_display_name: string | null;
  email: string | null;
  join_time: Date | null;
  leave_time: Date | null;
  duration_seconds: number | null;
  session_count: number;
  rejoin_count: number;
  match_state: "matched" | "unmatched" | "guest";
};

export type ZoomParticipantIntervalRow = {
  join_time: Date | null;
  leave_time: Date | null;
};

export type ZoomConnectionMetaRow = {
  status: "connected" | "disconnected" | "unknown";
  connected_at: Date | null;
  last_synced_at: Date | null;
  meetings_imported_today: number;
  has_connection_record: boolean;
};

export type ZoomMeetingsSummaryRow = {
  meeting_count: number;
  participant_count: number;
  matched_count: number;
  unmatched_count: number;
  total_attendance_seconds: number;
  avg_attendance_per_meeting: number | null;
  avg_duration_seconds: number | null;
};

export type ZoomParticipantsFilter = {
  meetingId: string;
  displayName?: string;
  email?: string;
  joinedFrom?: string;
  joinedTo?: string;
  matchState?: "all" | "matched" | "unmatched" | "guest";
  durationBucket?: "any" | "under_10" | "10_to_30" | "over_30";
  rejoinedOnly?: boolean;
};

export type ZoomParticipantSessionRow = {
  id: string;
  join_time: Date | null;
  leave_time: Date | null;
  duration_seconds: number | null;
  display_name: string | null;
};

export type ZoomParticipantIdentityDetail = {
  identity_key: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  zoom_display_name: string | null;
  email: string | null;
  membership_status: string | null;
  match_state: "matched" | "unmatched" | "guest";
  total_duration_seconds: number;
  session_count: number;
  rejoin_count: number;
  first_joined_at: Date | null;
  last_left_at: Date | null;
  sessions: ZoomParticipantSessionRow[];
};

export type ZoomPersonListRow = {
  identity_key: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  zoom_display_name: string | null;
  email: string | null;
  match_state: "matched" | "unmatched" | "guest";
  meetings_attended: number;
  total_duration_seconds: number;
  avg_duration_seconds: number | null;
  avg_coverage_percent: number | null;
  first_seen_at: Date | null;
  last_seen_at: Date | null;
  representative_meeting_id: string;
  representative_participant_id: string;
};

export type ZoomPeopleSummaryRow = {
  people_count: number;
  matched_count: number;
  unmatched_count: number;
  guest_count: number;
  avg_meetings_attended: number | null;
  total_duration_seconds: number;
  avg_coverage_percent: number | null;
  attended_once_only_count: number;
};

export type ZoomPersonMeetingRow = {
  meeting_id: string;
  participant_id: string;
  topic: string | null;
  external_meeting_id: string;
  started_at: Date | null;
  duration_seconds: number | null;
  coverage_percent: number | null;
  rejoin_count: number;
};

export type ZoomParticipantHistoryRow = {
  meeting_id: string;
  topic: string | null;
  started_at: Date | null;
  duration_seconds: number | null;
  meeting_duration_seconds: number | null;
  is_current: boolean;
};

function mapMeetingRow(row: Record<string, unknown>): ZoomMeetingListRow {
  return {
    id: String(row["id"]),
    external_meeting_id: String(row["external_meeting_id"]),
    topic: typeof row["topic"] === "string" ? row["topic"] : null,
    started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
    ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    attendance_count: Number(row["attendance_count"] ?? 0),
    matched_count: Number(row["matched_count"] ?? 0),
    unmatched_count: Number(row["unmatched_count"] ?? 0),
    total_attendance_seconds: Number(row["total_attendance_seconds"] ?? 0),
  };
}

function mapParticipantRow(row: Record<string, unknown>): ZoomParticipantRow {
  const matchStateRaw = typeof row["match_state"] === "string" ? row["match_state"] : "unmatched";
  const matchState =
    matchStateRaw === "matched" || matchStateRaw === "guest" ? matchStateRaw : "unmatched";
  return {
    id: String(row["id"]),
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    external_user_id: typeof row["external_user_id"] === "string" ? row["external_user_id"] : null,
    display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
    zoom_display_name:
      typeof row["zoom_display_name"] === "string" ? row["zoom_display_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    join_time: row["join_time"] instanceof Date ? row["join_time"] : null,
    leave_time: row["leave_time"] instanceof Date ? row["leave_time"] : null,
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    session_count: Number(row["session_count"] ?? 1),
    rejoin_count: Number(row["rejoin_count"] ?? 0),
    match_state: matchState,
  };
}

export const zoomInsightsRosterRepository = {
  async getConnectionMeta(tx: TenantTx): Promise<ZoomConnectionMetaRow> {
    const rows = await tx.$queryRaw<
      Array<{
        status: string | null;
        connected_at: Date | null;
        updated_at: Date | null;
        has_connection_record: boolean;
      }>
    >`
      select
        zc.status,
        zc.connected_at,
        zc.updated_at,
        true as has_connection_record
      from zoom_connections zc
      where zc.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;

    const connection = rows[0];
    const importedRows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from zoom_meetings zm
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zm.created_at >= date_trunc('day', now())
    `;
    const meetingsImportedToday = Number(importedRows[0]?.count ?? 0);

    const latestMeetingRows = await tx.$queryRaw<Array<{ last_synced_at: Date | null }>>`
      select max(zm.updated_at) as last_synced_at
      from zoom_meetings zm
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    const latestMeetingAt = latestMeetingRows[0]?.last_synced_at ?? null;

    if (!connection) {
      return {
        status: "unknown",
        connected_at: null,
        last_synced_at: latestMeetingAt,
        meetings_imported_today: meetingsImportedToday,
        has_connection_record: false,
      };
    }

    let status: ZoomConnectionMetaRow["status"] = "unknown";
    if (connection.status === "connected") status = "connected";
    else if (connection.status === "disconnected") status = "disconnected";

    const lastSyncedAt =
      latestMeetingAt && connection.updated_at
        ? latestMeetingAt > connection.updated_at
          ? latestMeetingAt
          : connection.updated_at
        : (latestMeetingAt ?? connection.updated_at);

    return {
      status,
      connected_at: connection.connected_at,
      last_synced_at: lastSyncedAt,
      meetings_imported_today: meetingsImportedToday,
      has_connection_record: true,
    };
  },

  async getConnectionStatus(tx: TenantTx): Promise<"connected" | "disconnected" | "unknown"> {
    const meta = await this.getConnectionMeta(tx);
    return meta.status;
  },

  async summarizeMeetings(
    tx: TenantTx,
    query: ZoomMeetingsListQuery,
  ): Promise<ZoomMeetingsSummaryRow> {
    const rows = await tx.$queryRaw<
      Array<{
        meeting_count: number;
        participant_count: number;
        matched_count: number;
        unmatched_count: number;
        total_attendance_seconds: number;
        avg_attendance_per_meeting: number | null;
        avg_duration_seconds: number | null;
      }>
    >`
      with filtered as (
        select
          zm.id,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          ) as attendance_count,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id
              and zmp.tenant_id = zm.tenant_id
              and zmp.membership_id is not null
          ) as matched_count,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id
              and zmp.tenant_id = zm.tenant_id
              and zmp.membership_id is null
          ) as unmatched_count,
          (
            select coalesce(sum(zmp.duration_seconds), 0)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          ) as total_attendance_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as duration_seconds
        from zoom_meetings zm
        where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(zm.topic, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(zm.external_meeting_id) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.startedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.startedFrom ?? null}::timestamptz
          )
          and (
            ${query.startedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.startedTo ?? null}::timestamptz
          )
      ),
      viewed as (
        select *
        from filtered
        where (
          ${query.view} = 'all'
          or (${query.view} = 'has_unmatched' and unmatched_count > 0)
          or (${query.view} = 'no_participants' and attendance_count = 0)
        )
      )
      select
        count(*)::int as meeting_count,
        coalesce(sum(attendance_count), 0)::int as participant_count,
        coalesce(sum(matched_count), 0)::int as matched_count,
        coalesce(sum(unmatched_count), 0)::int as unmatched_count,
        coalesce(sum(total_attendance_seconds), 0)::int as total_attendance_seconds,
        case
          when count(*) = 0 then null
          else round(avg(attendance_count)::numeric, 1)::float8
        end as avg_attendance_per_meeting,
        case
          when count(*) filter (where duration_seconds is not null) = 0 then null
          else round(avg(duration_seconds) filter (where duration_seconds is not null))::int
        end as avg_duration_seconds
      from viewed
    `;

    const row = rows[0];
    return {
      meeting_count: row?.meeting_count ?? 0,
      participant_count: row?.participant_count ?? 0,
      matched_count: row?.matched_count ?? 0,
      unmatched_count: row?.unmatched_count ?? 0,
      total_attendance_seconds: row?.total_attendance_seconds ?? 0,
      avg_attendance_per_meeting:
        row?.avg_attendance_per_meeting == null ? null : row.avg_attendance_per_meeting,
      avg_duration_seconds: row?.avg_duration_seconds == null ? null : row.avg_duration_seconds,
    };
  },

  async countMeetings(tx: TenantTx, query: ZoomMeetingsListQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with filtered as (
        select
          zm.id,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          ) as attendance_count,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id
              and zmp.tenant_id = zm.tenant_id
              and zmp.membership_id is null
          ) as unmatched_count
        from zoom_meetings zm
        where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(zm.topic, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(zm.external_meeting_id) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.startedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.startedFrom ?? null}::timestamptz
          )
          and (
            ${query.startedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.startedTo ?? null}::timestamptz
          )
      )
      select count(*)::bigint as count
      from filtered
      where (
        ${query.view} = 'all'
        or (${query.view} = 'has_unmatched' and unmatched_count > 0)
        or (${query.view} = 'no_participants' and attendance_count = 0)
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listMeetings(tx: TenantTx, query: ZoomMeetingsListQuery): Promise<ZoomMeetingListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with filtered as (
        select
          zm.id::text as id,
          zm.external_meeting_id,
          zm.topic,
          zm.started_at,
          zm.ended_at,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else (
              select coalesce(sum(zmp.duration_seconds), 0)::int
              from zoom_meeting_participants zmp
              where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
            )
          end as duration_seconds,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          ) as attendance_count,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id
              and zmp.tenant_id = zm.tenant_id
              and zmp.membership_id is not null
          ) as matched_count,
          (
            select count(*)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id
              and zmp.tenant_id = zm.tenant_id
              and zmp.membership_id is null
          ) as unmatched_count,
          (
            select coalesce(sum(zmp.duration_seconds), 0)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          ) as total_attendance_seconds
        from zoom_meetings zm
        where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(coalesce(zm.topic, '')) like '%' || lower(${query.q ?? null}) || '%'
            or lower(zm.external_meeting_id) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.startedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.startedFrom ?? null}::timestamptz
          )
          and (
            ${query.startedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.startedTo ?? null}::timestamptz
          )
      )
      select *
      from filtered
      where (
        ${query.view} = 'all'
        or (${query.view} = 'has_unmatched' and unmatched_count > 0)
        or (${query.view} = 'no_participants' and attendance_count = 0)
      )
      order by
        case when ${sortBy} = 'topic' and ${sortDir} = 'asc' then topic end asc nulls last,
        case when ${sortBy} = 'topic' and ${sortDir} = 'desc' then topic end desc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'asc' then started_at end asc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'desc' then started_at end desc nulls last,
        case when ${sortBy} = 'attendance_count' and ${sortDir} = 'asc' then attendance_count end asc nulls last,
        case when ${sortBy} = 'attendance_count' and ${sortDir} = 'desc' then attendance_count end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then duration_seconds end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then duration_seconds end desc nulls last,
        started_at desc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapMeetingRow);
  },

  async findMeetingById(tx: TenantTx, meetingId: string): Promise<ZoomMeetingListRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        zm.id::text as id,
        zm.external_meeting_id,
        zm.topic,
        zm.started_at,
        zm.ended_at,
        case
          when zm.started_at is not null and zm.ended_at is not null
            then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
          else (
            select coalesce(sum(zmp.duration_seconds), 0)::int
            from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          )
        end as duration_seconds,
        (
          select count(*)::int
          from zoom_meeting_participants zmp
          where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
        ) as attendance_count,
        (
          select count(*)::int
          from zoom_meeting_participants zmp
          where zmp.zoom_meeting_id = zm.id
            and zmp.tenant_id = zm.tenant_id
            and zmp.membership_id is not null
        ) as matched_count,
        (
          select count(*)::int
          from zoom_meeting_participants zmp
          where zmp.zoom_meeting_id = zm.id
            and zmp.tenant_id = zm.tenant_id
            and zmp.membership_id is null
        ) as unmatched_count,
        (
          select coalesce(sum(zmp.duration_seconds), 0)::int
          from zoom_meeting_participants zmp
          where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
        ) as total_attendance_seconds
      from zoom_meetings zm
      where zm.id = ${meetingId}::uuid
        and zm.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapMeetingRow(row) : null;
  },

  async meetingAttendanceTotals(
    tx: TenantTx,
    meetingId: string,
  ): Promise<{ totalAttendanceSeconds: number; avgDurationSeconds: number | null }> {
    const rows = await tx.$queryRaw<
      Array<{ total_seconds: number | null; avg_seconds: number | null }>
    >`
      select
        coalesce(sum(zmp.duration_seconds), 0)::int as total_seconds,
        case
          when count(*) filter (where zmp.duration_seconds is not null) = 0 then null
          else round(avg(zmp.duration_seconds) filter (where zmp.duration_seconds is not null))::int
        end as avg_seconds
      from zoom_meeting_participants zmp
      where zmp.zoom_meeting_id = ${meetingId}::uuid
        and zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    const row = rows[0];
    return {
      totalAttendanceSeconds: row?.total_seconds ?? 0,
      avgDurationSeconds: row?.avg_seconds == null ? null : row.avg_seconds,
    };
  },

  async listParticipantIntervals(
    tx: TenantTx,
    meetingId: string,
  ): Promise<ZoomParticipantIntervalRow[]> {
    const rows = await tx.$queryRaw<Array<{ join_time: Date | null; leave_time: Date | null }>>`
      select zmp.join_time, zmp.leave_time
      from zoom_meeting_participants zmp
      where zmp.zoom_meeting_id = ${meetingId}::uuid
        and zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zmp.join_time is not null
    `;
    return rows.map((row) => ({
      join_time: row.join_time,
      leave_time: row.leave_time,
    }));
  },

  async countParticipants(tx: TenantTx, filter: ZoomParticipantsFilter): Promise<number> {
    const matchState = filter.matchState ?? "all";
    const durationBucket = filter.durationBucket ?? "any";
    const rejoinedOnly = filter.rejoinedOnly ?? false;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with sessions as (
        select
          zmp.id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(zmp.display_name, mp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          zmp.duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${filter.meetingId}::uuid
          and (
            ${filter.displayName ?? null}::text is null
            or lower(coalesce(zmp.display_name, mp.display_name, ''))
              like '%' || lower(${filter.displayName ?? null}) || '%'
          )
          and (
            ${filter.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.email ?? null}) || '%'
          )
          and (
            ${filter.joinedFrom ?? null}::timestamptz is null
            or zmp.join_time >= ${filter.joinedFrom ?? null}::timestamptz
          )
          and (
            ${filter.joinedTo ?? null}::timestamptz is null
            or zmp.join_time <= ${filter.joinedTo ?? null}::timestamptz
          )
      ),
      aggregated as (
        select
          identity_key,
          max(membership_id::text) as membership_id,
          max(email) as email,
          max(display_name) as display_name,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          count(*)::int as session_count
        from sessions
        group by identity_key
      ),
      classified as (
        select
          *,
          case
            when membership_id is not null then 'matched'
            when email is null
              or lower(coalesce(display_name, '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from aggregated
      )
      select count(*)::bigint as count
      from classified
      where (
        ${matchState} = 'all'
        or match_state = ${matchState}
      )
      and (
        ${durationBucket} = 'any'
        or (${durationBucket} = 'under_10' and duration_seconds < 600)
        or (${durationBucket} = '10_to_30' and duration_seconds >= 600 and duration_seconds <= 1800)
        or (${durationBucket} = 'over_30' and duration_seconds > 1800)
      )
      and (
        ${rejoinedOnly} = false
        or session_count > 1
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async summarizeParticipants(
    tx: TenantTx,
    meetingId: string,
  ): Promise<{ matchedCount: number; unmatchedCount: number; guestCount: number }> {
    const rows = await tx.$queryRaw<
      Array<{ matched_count: number; unmatched_count: number; guest_count: number }>
    >`
      with sessions as (
        select
          zmp.membership_id,
          zmp.external_user_id,
          coalesce(zmp.display_name, mp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.zoom_meeting_id = ${meetingId}::uuid
          and zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      aggregated as (
        select
          identity_key,
          max(membership_id::text) as membership_id,
          max(email) as email,
          max(display_name) as display_name
        from sessions
        group by identity_key
      )
      select
        count(*) filter (where membership_id is not null)::int as matched_count,
        count(*) filter (
          where membership_id is null
            and email is not null
            and lower(coalesce(display_name, '')) not like 'guest%'
        )::int as unmatched_count,
        count(*) filter (
          where membership_id is null
            and (
              email is null
              or lower(coalesce(display_name, '')) like 'guest%'
            )
        )::int as guest_count
      from aggregated
    `;
    return {
      matchedCount: rows[0]?.matched_count ?? 0,
      unmatchedCount: rows[0]?.unmatched_count ?? 0,
      guestCount: rows[0]?.guest_count ?? 0,
    };
  },

  async listParticipants(
    tx: TenantTx,
    meetingId: string,
    query: ZoomParticipantsQuery,
  ): Promise<ZoomParticipantRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const matchState = query.matchState;
    const durationBucket = query.durationBucket;
    const rejoinedOnly = query.rejoinedOnly;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          zmp.duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${meetingId}::uuid
          and (
            ${query.displayName ?? null}::text is null
            or lower(coalesce(zmp.display_name, mp.display_name, ''))
              like '%' || lower(${query.displayName ?? null}) || '%'
          )
          and (
            ${query.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.email ?? null}) || '%'
          )
          and (
            ${query.joinedFrom ?? null}::timestamptz is null
            or zmp.join_time >= ${query.joinedFrom ?? null}::timestamptz
          )
          and (
            ${query.joinedTo ?? null}::timestamptz is null
            or zmp.join_time <= ${query.joinedTo ?? null}::timestamptz
          )
      ),
      aggregated as (
        select
          (array_agg(id::text order by join_time asc nulls last))[1] as id,
          max(membership_id::text) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          min(join_time) as join_time,
          max(leave_time) as leave_time,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          count(*)::int as session_count,
          greatest(count(*)::int - 1, 0)::int as rejoin_count
        from sessions
        group by identity_key
      ),
      classified as (
        select
          *,
          case
            when membership_id is not null then 'matched'
            when email is null
              or lower(coalesce(display_name, '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from aggregated
      )
      select *
      from classified
      where (
        ${matchState} = 'all'
        or match_state = ${matchState}
      )
      and (
        ${durationBucket} = 'any'
        or (${durationBucket} = 'under_10' and duration_seconds < 600)
        or (${durationBucket} = '10_to_30' and duration_seconds >= 600 and duration_seconds <= 1800)
        or (${durationBucket} = 'over_30' and duration_seconds > 1800)
      )
      and (
        ${rejoinedOnly} = false
        or session_count > 1
      )
      order by
        case when ${sortBy} = 'display_name' and ${sortDir} = 'asc' then display_name end asc nulls last,
        case when ${sortBy} = 'display_name' and ${sortDir} = 'desc' then display_name end desc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'asc' then email end asc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'desc' then email end desc nulls last,
        case when ${sortBy} = 'join_time' and ${sortDir} = 'asc' then join_time end asc nulls last,
        case when ${sortBy} = 'join_time' and ${sortDir} = 'desc' then join_time end desc nulls last,
        case when ${sortBy} = 'leave_time' and ${sortDir} = 'asc' then leave_time end asc nulls last,
        case when ${sortBy} = 'leave_time' and ${sortDir} = 'desc' then leave_time end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then duration_seconds end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then duration_seconds end desc nulls last,
        case when ${sortBy} = 'rejoins' and ${sortDir} = 'asc' then rejoin_count end asc nulls last,
        case when ${sortBy} = 'rejoins' and ${sortDir} = 'desc' then rejoin_count end desc nulls last,
        join_time asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapParticipantRow);
  },

  async findParticipantIdentityDetail(
    tx: TenantTx,
    meetingId: string,
    participantId: string,
  ): Promise<ZoomParticipantIdentityDetail | null> {
    const seedRows = await tx.$queryRaw<
      Array<{
        identity_key: string;
        membership_id: string | null;
        external_user_id: string | null;
        display_name: string | null;
        zoom_display_name: string | null;
        email: string | null;
        membership_status: string | null;
      }>
    >`
      select
        coalesce(
          'm:' || zmp.membership_id::text,
          'e:' || nullif(zmp.external_user_id, ''),
          'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
            || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
        ) as identity_key,
        zmp.membership_id::text as membership_id,
        zmp.external_user_id,
        coalesce(mp.display_name, zmp.display_name) as display_name,
        zmp.display_name as zoom_display_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        m.status::text as membership_status
      from zoom_meeting_participants zmp
      left join memberships m
        on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zmp.zoom_meeting_id = ${meetingId}::uuid
        and zmp.id = ${participantId}::uuid
      limit 1
    `;
    const seed = seedRows[0];
    if (!seed) return null;

    const sessionRows = await tx.$queryRaw<
      Array<{
        id: string;
        join_time: Date | null;
        leave_time: Date | null;
        duration_seconds: number | null;
        display_name: string | null;
        membership_id: string | null;
        email: string | null;
      }>
    >`
      with sessions as (
        select
          zmp.id::text as id,
          zmp.join_time,
          zmp.leave_time,
          zmp.duration_seconds,
          zmp.display_name,
          zmp.membership_id::text as membership_id,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${meetingId}::uuid
      )
      select id, join_time, leave_time, duration_seconds, display_name, membership_id, email
      from sessions
      where identity_key = ${seed.identity_key}
      order by join_time asc nulls last, id asc
    `;

    if (sessionRows.length === 0) return null;

    const membershipId =
      sessionRows.find((row) => row.membership_id)?.membership_id ?? seed.membership_id;
    const email = sessionRows.find((row) => row.email)?.email ?? seed.email;
    const displayName = seed.display_name;
    const matchState: "matched" | "unmatched" | "guest" = membershipId
      ? "matched"
      : !email || (displayName != null && displayName.toLowerCase().startsWith("guest"))
        ? "guest"
        : "unmatched";

    const totalDuration = sessionRows.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
    const joins = sessionRows
      .map((row) => row.join_time)
      .filter((value): value is Date => value != null);
    const leaves = sessionRows
      .map((row) => row.leave_time)
      .filter((value): value is Date => value != null);

    return {
      identity_key: seed.identity_key,
      membership_id: membershipId,
      external_user_id: seed.external_user_id,
      display_name: displayName,
      zoom_display_name: seed.zoom_display_name,
      email,
      membership_status: seed.membership_status,
      match_state: matchState,
      total_duration_seconds: totalDuration,
      session_count: sessionRows.length,
      rejoin_count: Math.max(sessionRows.length - 1, 0),
      first_joined_at:
        joins.length > 0 ? new Date(Math.min(...joins.map((d) => d.getTime()))) : null,
      last_left_at:
        leaves.length > 0 ? new Date(Math.max(...leaves.map((d) => d.getTime()))) : null,
      sessions: sessionRows.map((row) => ({
        id: row.id,
        join_time: row.join_time,
        leave_time: row.leave_time,
        duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
        display_name: row.display_name,
      })),
    };
  },

  async listParticipantAttendanceHistory(
    tx: TenantTx,
    args: {
      meetingId: string;
      membershipId: string | null;
      externalUserId: string | null;
      limit?: number;
    },
  ): Promise<ZoomParticipantHistoryRow[]> {
    if (!args.membershipId && !args.externalUserId) return [];
    const limit = args.limit ?? 8;
    const rows = await tx.$queryRaw<
      Array<{
        meeting_id: string;
        topic: string | null;
        started_at: Date | null;
        duration_seconds: number | null;
        meeting_duration_seconds: number | null;
        is_current: boolean;
      }>
    >`
      select
        zm.id::text as meeting_id,
        zm.topic,
        zm.started_at,
        coalesce(sum(zmp.duration_seconds), 0)::int as duration_seconds,
        zm.duration_seconds as meeting_duration_seconds,
        (zm.id = ${args.meetingId}::uuid) as is_current
      from zoom_meetings zm
      join zoom_meeting_participants zmp
        on zmp.zoom_meeting_id = zm.id
       and zmp.tenant_id = zm.tenant_id
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          (${args.membershipId ?? null}::uuid is not null and zmp.membership_id = ${args.membershipId ?? null}::uuid)
          or (
            ${args.externalUserId ?? null}::text is not null
            and zmp.external_user_id = ${args.externalUserId ?? null}
          )
        )
      group by zm.id, zm.topic, zm.started_at, zm.duration_seconds
      order by zm.started_at desc nulls last
      limit ${limit}
    `;
    return rows.map((row) => ({
      meeting_id: row.meeting_id,
      topic: row.topic,
      started_at: row.started_at,
      duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
      meeting_duration_seconds:
        row.meeting_duration_seconds == null ? null : row.meeting_duration_seconds,
      is_current: row.is_current,
    }));
  },

  async countOtherUnmatchedMeetingsForIdentity(
    tx: TenantTx,
    args: {
      meetingId: string;
      externalUserId: string | null;
      email: string | null;
      displayName: string | null;
    },
  ): Promise<number> {
    if (!args.externalUserId && !args.email && !args.displayName) return 0;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(distinct zmp.zoom_meeting_id)::bigint as count
      from zoom_meeting_participants zmp
      left join memberships m
        on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zmp.zoom_meeting_id <> ${args.meetingId}::uuid
        and zmp.membership_id is null
        and (
          (
            ${args.externalUserId ?? null}::text is not null
            and zmp.external_user_id = ${args.externalUserId ?? null}
          )
          or (
            ${args.email ?? null}::text is not null
            and lower(coalesce(ap.email, m.invited_email_normalized, '')) = lower(${args.email ?? null})
          )
          or (
            ${args.displayName ?? null}::text is not null
            and lower(coalesce(zmp.display_name, '')) = lower(${args.displayName ?? null})
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async matchParticipantIdentity(
    tx: TenantTx,
    args: {
      meetingId: string;
      identityKey: string;
      membershipId: string;
      applyToOtherMeetings: boolean;
      externalUserId: string | null;
      email: string | null;
      displayName: string | null;
    },
  ): Promise<{ updatedRowCount: number; updatedMeetingCount: number }> {
    const membership = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from memberships
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${args.membershipId}::uuid
        and status = 'ACTIVE'
      limit 1
    `;
    if (!membership[0]) {
      return { updatedRowCount: 0, updatedMeetingCount: 0 };
    }

    const meetingRows = await tx.$queryRaw<Array<{ id: string }>>`
      with target as (
        select zmp.id
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${args.meetingId}::uuid
          and coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) = ${args.identityKey}
      )
      update zoom_meeting_participants zmp
      set membership_id = ${args.membershipId}::uuid,
          updated_at = now()
      from target
      where zmp.id = target.id
      returning zmp.id::text as id
    `;

    let otherRows: Array<{ id: string; meeting_id: string }> = [];
    if (args.applyToOtherMeetings) {
      otherRows = await tx.$queryRaw<Array<{ id: string; meeting_id: string }>>`
        update zoom_meeting_participants zmp
        set membership_id = ${args.membershipId}::uuid,
            updated_at = now()
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id <> ${args.meetingId}::uuid
          and zmp.membership_id is null
          and (
            (
              ${args.externalUserId ?? null}::text is not null
              and zmp.external_user_id = ${args.externalUserId ?? null}
            )
            or (
              ${args.displayName ?? null}::text is not null
              and lower(coalesce(zmp.display_name, '')) = lower(${args.displayName ?? null})
            )
          )
        returning zmp.id::text as id, zmp.zoom_meeting_id::text as meeting_id
      `;
    }

    const meetingIds = new Set<string>([args.meetingId]);
    for (const row of otherRows) meetingIds.add(row.meeting_id);
    return {
      updatedRowCount: meetingRows.length + otherRows.length,
      updatedMeetingCount: meetingIds.size,
    };
  },

  async unlinkParticipantIdentity(
    tx: TenantTx,
    args: { meetingId: string; identityKey: string },
  ): Promise<{ updatedRowCount: number }> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      with target as (
        select zmp.id
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${args.meetingId}::uuid
          and coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) = ${args.identityKey}
      )
      update zoom_meeting_participants zmp
      set membership_id = null,
          updated_at = now()
      from target
      where zmp.id = target.id
      returning zmp.id::text as id
    `;
    return { updatedRowCount: rows.length };
  },

  async markParticipantIdentityGuest(
    tx: TenantTx,
    args: { meetingId: string; identityKey: string },
  ): Promise<{ updatedRowCount: number }> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      with target as (
        select zmp.id, zmp.display_name
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${args.meetingId}::uuid
          and coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) = ${args.identityKey}
      )
      update zoom_meeting_participants zmp
      set membership_id = null,
          display_name = case
            when lower(coalesce(target.display_name, '')) like 'guest%' then target.display_name
            when coalesce(target.display_name, '') = '' then 'Guest'
            else 'Guest · ' || target.display_name
          end,
          updated_at = now()
      from target
      where zmp.id = target.id
      returning zmp.id::text as id
    `;
    return { updatedRowCount: rows.length };
  },

  async countMeetingsInRange(
    tx: TenantTx,
    attendedFrom?: string,
    attendedTo?: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from zoom_meetings zm
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${attendedFrom ?? null}::timestamptz is null
          or zm.started_at >= ${attendedFrom ?? null}::timestamptz
        )
        and (
          ${attendedTo ?? null}::timestamptz is null
          or zm.started_at <= ${attendedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countPeople(tx: TenantTx, query: ZoomPeopleListQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      per_meeting as (
        select
          identity_key,
          zoom_meeting_id,
          max(membership_id::text) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds,
          min(join_time) as first_join,
          max(leave_time) as last_leave,
          (array_agg(id::text order by join_time asc nulls last))[1] as participant_id
        from sessions
        group by identity_key, zoom_meeting_id
      ),
      people as (
        select
          identity_key,
          max(membership_id) as membership_id,
          max(display_name) as display_name,
          max(email) as email,
          count(*)::int as meetings_attended,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          case
            when count(*) filter (where meeting_duration_seconds > 0) = 0 then null
            else round(
              (
                avg(
                  least(
                    100.0,
                    (duration_seconds::float8 * 100.0) / nullif(meeting_duration_seconds, 0)
                  )
                ) filter (where meeting_duration_seconds > 0)
              )::numeric,
              1
            )::float8
          end as avg_coverage_percent,
          case
            when max(membership_id) is not null then 'matched'
            when max(email) is null
              or lower(coalesce(max(display_name), '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from per_meeting
        group by identity_key
      )
      select count(*)::bigint as count
      from people
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(display_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(email, '')) like '%' || lower(${query.q ?? null}) || '%'
      )
      and (
        ${query.matchState} = 'all'
        or match_state = ${query.matchState}
      )
      and (
        ${query.meetingsMin ?? null}::int is null
        or meetings_attended >= ${query.meetingsMin ?? null}::int
      )
      and (
        ${query.meetingsMax ?? null}::int is null
        or meetings_attended <= ${query.meetingsMax ?? null}::int
      )
      and (
        ${query.coverageMin ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) >= ${query.coverageMin ?? null}::float8
      )
      and (
        ${query.coverageMax ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) <= ${query.coverageMax ?? null}::float8
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listPeople(tx: TenantTx, query: ZoomPeopleListQuery): Promise<ZoomPersonListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      per_meeting as (
        select
          identity_key,
          zoom_meeting_id,
          max(membership_id::text) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds,
          min(join_time) as first_join,
          max(coalesce(leave_time, join_time)) as last_leave,
          (array_agg(id::text order by join_time asc nulls last))[1] as participant_id
        from sessions
        group by identity_key, zoom_meeting_id
      ),
      people as (
        select
          identity_key,
          max(membership_id) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          count(*)::int as meetings_attended,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          case
            when count(*) = 0 then null
            else round(avg(duration_seconds))::int
          end as avg_duration_seconds,
          case
            when count(*) filter (where meeting_duration_seconds > 0) = 0 then null
            else round(
              (
                avg(
                  least(
                    100.0,
                    (duration_seconds::float8 * 100.0) / nullif(meeting_duration_seconds, 0)
                  )
                ) filter (where meeting_duration_seconds > 0)
              )::numeric,
              1
            )::float8
          end as avg_coverage_percent,
          min(first_join) as first_seen_at,
          max(last_leave) as last_seen_at,
          (array_agg(zoom_meeting_id::text order by last_leave desc nulls last))[1]
            as representative_meeting_id,
          (array_agg(participant_id order by last_leave desc nulls last))[1]
            as representative_participant_id,
          case
            when max(membership_id) is not null then 'matched'
            when max(email) is null
              or lower(coalesce(max(display_name), '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from per_meeting
        group by identity_key
      )
      select *
      from people
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(display_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(email, '')) like '%' || lower(${query.q ?? null}) || '%'
      )
      and (
        ${query.matchState} = 'all'
        or match_state = ${query.matchState}
      )
      and (
        ${query.meetingsMin ?? null}::int is null
        or meetings_attended >= ${query.meetingsMin ?? null}::int
      )
      and (
        ${query.meetingsMax ?? null}::int is null
        or meetings_attended <= ${query.meetingsMax ?? null}::int
      )
      and (
        ${query.coverageMin ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) >= ${query.coverageMin ?? null}::float8
      )
      and (
        ${query.coverageMax ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) <= ${query.coverageMax ?? null}::float8
      )
      order by
        case when ${sortBy} = 'display_name' and ${sortDir} = 'asc' then display_name end asc nulls last,
        case when ${sortBy} = 'display_name' and ${sortDir} = 'desc' then display_name end desc nulls last,
        case when ${sortBy} = 'meetings_attended' and ${sortDir} = 'asc' then meetings_attended end asc,
        case when ${sortBy} = 'meetings_attended' and ${sortDir} = 'desc' then meetings_attended end desc,
        case when ${sortBy} = 'total_time' and ${sortDir} = 'asc' then total_duration_seconds end asc,
        case when ${sortBy} = 'total_time' and ${sortDir} = 'desc' then total_duration_seconds end desc,
        case when ${sortBy} = 'avg_duration' and ${sortDir} = 'asc' then avg_duration_seconds end asc nulls last,
        case when ${sortBy} = 'avg_duration' and ${sortDir} = 'desc' then avg_duration_seconds end desc nulls last,
        case when ${sortBy} = 'avg_coverage' and ${sortDir} = 'asc' then avg_coverage_percent end asc nulls last,
        case when ${sortBy} = 'avg_coverage' and ${sortDir} = 'desc' then avg_coverage_percent end desc nulls last,
        case when ${sortBy} = 'first_seen' and ${sortDir} = 'asc' then first_seen_at end asc nulls last,
        case when ${sortBy} = 'first_seen' and ${sortDir} = 'desc' then first_seen_at end desc nulls last,
        case when ${sortBy} = 'last_seen' and ${sortDir} = 'asc' then last_seen_at end asc nulls last,
        case when ${sortBy} = 'last_seen' and ${sortDir} = 'desc' then last_seen_at end desc nulls last,
        meetings_attended desc,
        display_name asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapPersonListRow);
  },

  async summarizePeople(tx: TenantTx, query: ZoomPeopleListQuery): Promise<ZoomPeopleSummaryRow> {
    const rows = await tx.$queryRaw<
      Array<{
        people_count: number;
        matched_count: number;
        unmatched_count: number;
        guest_count: number;
        avg_meetings_attended: number | null;
        total_duration_seconds: number;
        avg_coverage_percent: number | null;
        attended_once_only_count: number;
      }>
    >`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      per_meeting as (
        select
          identity_key,
          zoom_meeting_id,
          max(membership_id::text) as membership_id,
          max(display_name) as display_name,
          max(email) as email,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds
        from sessions
        group by identity_key, zoom_meeting_id
      ),
      people as (
        select
          identity_key,
          count(*)::int as meetings_attended,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          case
            when count(*) filter (where meeting_duration_seconds > 0) = 0 then null
            else (
              avg(
                least(
                  100.0,
                  (duration_seconds::float8 * 100.0) / nullif(meeting_duration_seconds, 0)
                )
              ) filter (where meeting_duration_seconds > 0)
            )::float8
          end as avg_coverage_percent,
          case
            when max(membership_id) is not null then 'matched'
            when max(email) is null
              or lower(coalesce(max(display_name), '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from per_meeting
        group by identity_key
      )
      select
        count(*)::int as people_count,
        count(*) filter (where match_state = 'matched')::int as matched_count,
        count(*) filter (where match_state = 'unmatched')::int as unmatched_count,
        count(*) filter (where match_state = 'guest')::int as guest_count,
        case
          when count(*) = 0 then null
          else round(avg(meetings_attended)::numeric, 1)::float8
        end as avg_meetings_attended,
        coalesce(sum(total_duration_seconds), 0)::int as total_duration_seconds,
        case
          when count(*) filter (where avg_coverage_percent is not null) = 0 then null
          else round(
            (avg(avg_coverage_percent) filter (where avg_coverage_percent is not null))::numeric,
            1
          )::float8
        end as avg_coverage_percent,
        count(*) filter (where meetings_attended = 1)::int as attended_once_only_count
      from people
    `;

    const row = rows[0];
    return {
      people_count: row?.people_count ?? 0,
      matched_count: row?.matched_count ?? 0,
      unmatched_count: row?.unmatched_count ?? 0,
      guest_count: row?.guest_count ?? 0,
      avg_meetings_attended: row?.avg_meetings_attended == null ? null : row.avg_meetings_attended,
      total_duration_seconds: row?.total_duration_seconds ?? 0,
      avg_coverage_percent: row?.avg_coverage_percent == null ? null : row.avg_coverage_percent,
      attended_once_only_count: row?.attended_once_only_count ?? 0,
    };
  },

  async listPersonMeetings(
    tx: TenantTx,
    query: ZoomPersonMeetingsQuery,
  ): Promise<{
    person: {
      identity_key: string;
      membership_id: string | null;
      display_name: string | null;
      email: string | null;
      match_state: "matched" | "unmatched" | "guest";
      representative_meeting_id: string | null;
      representative_participant_id: string | null;
    } | null;
    meetings: ZoomPersonMeetingRow[];
  }> {
    const meetingRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          zmp.external_user_id,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          zm.topic,
          zm.external_meeting_id,
          zm.started_at,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      filtered as (
        select * from sessions where identity_key = ${query.identityKey}
      ),
      per_meeting as (
        select
          zoom_meeting_id,
          (array_agg(id::text order by join_time asc nulls last))[1] as participant_id,
          max(membership_id::text) as membership_id,
          max(display_name) as display_name,
          max(email) as email,
          max(topic) as topic,
          max(external_meeting_id) as external_meeting_id,
          max(started_at) as started_at,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds,
          greatest(count(*)::int - 1, 0)::int as rejoin_count
        from filtered
        group by zoom_meeting_id
      )
      select
        zoom_meeting_id::text as meeting_id,
        participant_id,
        membership_id,
        display_name,
        email,
        topic,
        external_meeting_id,
        started_at,
        duration_seconds,
        case
          when meeting_duration_seconds is null or meeting_duration_seconds <= 0 then null
          else round(
            least(100.0, (duration_seconds::float8 * 100.0) / meeting_duration_seconds)::numeric,
            1
          )::float8
        end as coverage_percent,
        rejoin_count
      from per_meeting
      order by started_at desc nulls last
    `;

    if (meetingRows.length === 0) {
      return { person: null, meetings: [] };
    }

    const meetings = meetingRows.map(mapPersonMeetingRow);
    const first = meetingRows[0];
    if (first == null) {
      return { person: null, meetings: [] };
    }
    const anyMembership = meetingRows.find(
      (row) => typeof row["membership_id"] === "string" && row["membership_id"],
    );
    const displayName = typeof first["display_name"] === "string" ? first["display_name"] : null;
    const email =
      (typeof anyMembership?.["email"] === "string" ? anyMembership["email"] : null) ??
      (typeof first["email"] === "string" ? first["email"] : null);
    const membership =
      typeof anyMembership?.["membership_id"] === "string" ? anyMembership["membership_id"] : null;
    const matchState: "matched" | "unmatched" | "guest" = membership
      ? "matched"
      : !email || (displayName != null && displayName.toLowerCase().startsWith("guest"))
        ? "guest"
        : "unmatched";

    return {
      person: {
        identity_key: query.identityKey,
        membership_id: membership,
        display_name: displayName,
        email,
        match_state: matchState,
        representative_meeting_id: meetings[0]?.meeting_id ?? null,
        representative_participant_id: meetings[0]?.participant_id ?? null,
      },
      meetings,
    };
  },
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapPersonListRow(row: Record<string, unknown>): ZoomPersonListRow {
  return {
    identity_key: typeof row["identity_key"] === "string" ? row["identity_key"] : "",
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    external_user_id: typeof row["external_user_id"] === "string" ? row["external_user_id"] : null,
    display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
    zoom_display_name:
      typeof row["zoom_display_name"] === "string" ? row["zoom_display_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    match_state:
      row["match_state"] === "matched" ||
      row["match_state"] === "unmatched" ||
      row["match_state"] === "guest"
        ? row["match_state"]
        : "unmatched",
    meetings_attended: Number(row["meetings_attended"] ?? 0),
    total_duration_seconds: Number(row["total_duration_seconds"] ?? 0),
    avg_duration_seconds:
      row["avg_duration_seconds"] == null ? null : Number(row["avg_duration_seconds"]),
    avg_coverage_percent:
      row["avg_coverage_percent"] == null ? null : Number(row["avg_coverage_percent"]),
    first_seen_at: asDate(row["first_seen_at"]),
    last_seen_at: asDate(row["last_seen_at"]),
    representative_meeting_id:
      typeof row["representative_meeting_id"] === "string" ? row["representative_meeting_id"] : "",
    representative_participant_id:
      typeof row["representative_participant_id"] === "string"
        ? row["representative_participant_id"]
        : "",
  };
}

function mapPersonMeetingRow(row: Record<string, unknown>): ZoomPersonMeetingRow {
  return {
    meeting_id: typeof row["meeting_id"] === "string" ? row["meeting_id"] : "",
    participant_id: typeof row["participant_id"] === "string" ? row["participant_id"] : "",
    topic: typeof row["topic"] === "string" ? row["topic"] : null,
    external_meeting_id:
      typeof row["external_meeting_id"] === "string" ? row["external_meeting_id"] : "",
    started_at: asDate(row["started_at"]),
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    coverage_percent: row["coverage_percent"] == null ? null : Number(row["coverage_percent"]),
    rejoin_count: Number(row["rejoin_count"] ?? 0),
  };
}
