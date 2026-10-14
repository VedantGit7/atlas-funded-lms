import type { TenantTx } from "@atlas/db";
import type { ZoomMeetingsListQuery } from "./zoom-insights-roster.dto";
import type {
  ZoomConnectionMetaRow,
  ZoomMeetingListRow,
  ZoomMeetingsSummaryRow,
  ZoomParticipantIntervalRow,
} from "./zoom-insights-roster.repository";

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

/**
 * The Zoom connection, meetings and one meeting's attendance.
 * Part of zoomInsightsRosterRepository.
 */
export const zoomInsightsRosterMeetingsRepository = {
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
};
