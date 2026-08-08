import type { TenantTx } from "@atlas/db";
import type { ZoomMeetingsListQuery, ZoomParticipantsQuery } from "./zoom-insights-roster.dto";

export type ZoomMeetingListRow = {
  id: string;
  external_meeting_id: string;
  topic: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  attendance_count: number;
};

export type ZoomParticipantRow = {
  id: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  email: string | null;
  join_time: Date | null;
  leave_time: Date | null;
  duration_seconds: number | null;
};

export type ZoomParticipantsFilter = {
  meetingId: string;
  displayName?: string;
  email?: string;
  joinedFrom?: string;
  joinedTo?: string;
};

function mapMeetingRow(row: Record<string, unknown>): ZoomMeetingListRow {
  return {
    id: String(row["id"]),
    external_meeting_id: String(row["external_meeting_id"]),
    topic: typeof row["topic"] === "string" ? row["topic"] : null,
    started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
    ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
    duration_seconds:
      row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    attendance_count: Number(row["attendance_count"] ?? 0),
  };
}

function mapParticipantRow(row: Record<string, unknown>): ZoomParticipantRow {
  return {
    id: String(row["id"]),
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    external_user_id:
      typeof row["external_user_id"] === "string" ? row["external_user_id"] : null,
    display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    join_time: row["join_time"] instanceof Date ? row["join_time"] : null,
    leave_time: row["leave_time"] instanceof Date ? row["leave_time"] : null,
    duration_seconds:
      row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
  };
}

export const zoomInsightsRosterRepository = {
  async getConnectionStatus(
    tx: TenantTx,
  ): Promise<"connected" | "disconnected" | "unknown"> {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      select status from zoom_connections limit 1
    `;
    const status = rows[0]?.status;
    if (!status) return "unknown";
    if (status === "connected") return "connected";
    if (status === "disconnected") return "disconnected";
    return "unknown";
  },

  async countMeetings(tx: TenantTx, query: ZoomMeetingsListQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
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
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listMeetings(
    tx: TenantTx,
    query: ZoomMeetingsListQuery,
  ): Promise<ZoomMeetingListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

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
        ) as attendance_count
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
      order by
        case when ${sortBy} = 'topic' and ${sortDir} = 'asc' then zm.topic end asc nulls last,
        case when ${sortBy} = 'topic' and ${sortDir} = 'desc' then zm.topic end desc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'asc' then zm.started_at end asc nulls last,
        case when ${sortBy} = 'started_at' and ${sortDir} = 'desc' then zm.started_at end desc nulls last,
        case
          when ${sortBy} = 'attendance_count' and ${sortDir} = 'asc' then (
            select count(*)::int from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          )
        end asc nulls last,
        case
          when ${sortBy} = 'attendance_count' and ${sortDir} = 'desc' then (
            select count(*)::int from zoom_meeting_participants zmp
            where zmp.zoom_meeting_id = zm.id and zmp.tenant_id = zm.tenant_id
          )
        end desc nulls last,
        case
          when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then
            case
              when zm.started_at is not null and zm.ended_at is not null
                then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
              else 0
            end
        end asc nulls last,
        case
          when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then
            case
              when zm.started_at is not null and zm.ended_at is not null
                then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
              else 0
            end
        end desc nulls last,
        zm.started_at desc nulls last
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
        ) as attendance_count
      from zoom_meetings zm
      where zm.id = ${meetingId}::uuid
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
      totalAttendanceSeconds: Number(row?.total_seconds ?? 0),
      avgDurationSeconds: row?.avg_seconds == null ? null : Number(row.avg_seconds),
    };
  },

  async countParticipants(tx: TenantTx, filter: ZoomParticipantsFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
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
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listParticipants(
    tx: TenantTx,
    meetingId: string,
    query: ZoomParticipantsQuery,
  ): Promise<ZoomParticipantRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        zmp.id::text as id,
        zmp.membership_id::text as membership_id,
        zmp.external_user_id,
        coalesce(zmp.display_name, mp.display_name) as display_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        zmp.join_time,
        zmp.leave_time,
        zmp.duration_seconds
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
      order by
        case when ${sortBy} = 'display_name' and ${sortDir} = 'asc'
          then coalesce(zmp.display_name, mp.display_name) end asc nulls last,
        case when ${sortBy} = 'display_name' and ${sortDir} = 'desc'
          then coalesce(zmp.display_name, mp.display_name) end desc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'asc'
          then coalesce(ap.email, m.invited_email_normalized) end asc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'desc'
          then coalesce(ap.email, m.invited_email_normalized) end desc nulls last,
        case when ${sortBy} = 'join_time' and ${sortDir} = 'asc' then zmp.join_time end asc nulls last,
        case when ${sortBy} = 'join_time' and ${sortDir} = 'desc' then zmp.join_time end desc nulls last,
        case when ${sortBy} = 'leave_time' and ${sortDir} = 'asc' then zmp.leave_time end asc nulls last,
        case when ${sortBy} = 'leave_time' and ${sortDir} = 'desc' then zmp.leave_time end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then zmp.duration_seconds end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then zmp.duration_seconds end desc nulls last,
        zmp.join_time asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapParticipantRow);
  },
};
