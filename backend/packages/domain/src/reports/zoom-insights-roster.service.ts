import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  zoomMeetingDetailResponseSchema,
  zoomMeetingsListResponseSchema,
  zoomParticipantsListResponseSchema,
  type ZoomMeetingsListQuery,
  type ZoomParticipantsQuery,
} from "./zoom-insights-roster.dto";
import { zoomMeetingNotFound } from "./zoom-insights-roster.errors";
import {
  zoomInsightsRosterRepository,
  type ZoomMeetingListRow,
  type ZoomParticipantsFilter,
} from "./zoom-insights-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function mapMeetingListItem(row: ZoomMeetingListRow) {
  return {
    id: row.id,
    externalMeetingId: row.external_meeting_id,
    topic: row.topic,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    attendanceCount: row.attendance_count,
  };
}

function toParticipantFilter(
  meetingId: string,
  input: Partial<{
    displayName?: string;
    email?: string;
    joinedFrom?: string;
    joinedTo?: string;
  }>,
): ZoomParticipantsFilter {
  const filter: ZoomParticipantsFilter = { meetingId };
  if (input.displayName) filter.displayName = input.displayName;
  if (input.email) filter.email = input.email;
  if (input.joinedFrom) filter.joinedFrom = input.joinedFrom;
  if (input.joinedTo) filter.joinedTo = input.joinedTo;
  return filter;
}

export async function listZoomInsightsMeetings(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ZoomMeetingsListQuery,
) {
  const [totalCount, rows, connectionStatus] = await Promise.all([
    zoomInsightsRosterRepository.countMeetings(tx, query),
    zoomInsightsRosterRepository.listMeetings(tx, query),
    zoomInsightsRosterRepository.getConnectionStatus(tx),
  ]);

  return zoomMeetingsListResponseSchema.parse({
    data: {
      items: rows.map(mapMeetingListItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      connectionStatus,
    },
  });
}

export async function getZoomMeetingDetailedReport(
  tx: TenantTx,
  _ctx: ServiceCtx,
  meetingId: string,
) {
  const meta = await zoomInsightsRosterRepository.findMeetingById(tx, meetingId);
  if (!meta) throw zoomMeetingNotFound();

  const totals = await zoomInsightsRosterRepository.meetingAttendanceTotals(tx, meetingId);

  return zoomMeetingDetailResponseSchema.parse({
    data: {
      ...mapMeetingListItem(meta),
      totalAttendanceSeconds: totals.totalAttendanceSeconds,
      avgDurationSeconds: totals.avgDurationSeconds,
    },
  });
}

export async function listZoomMeetingParticipants(
  tx: TenantTx,
  _ctx: ServiceCtx,
  meetingId: string,
  query: ZoomParticipantsQuery,
) {
  const meta = await zoomInsightsRosterRepository.findMeetingById(tx, meetingId);
  if (!meta) throw zoomMeetingNotFound();

  const filter = toParticipantFilter(meetingId, {
    ...(query.displayName ? { displayName: query.displayName } : {}),
    ...(query.email ? { email: query.email } : {}),
    ...(query.joinedFrom ? { joinedFrom: query.joinedFrom } : {}),
    ...(query.joinedTo ? { joinedTo: query.joinedTo } : {}),
  });

  const [totalCount, rows] = await Promise.all([
    zoomInsightsRosterRepository.countParticipants(tx, filter),
    zoomInsightsRosterRepository.listParticipants(tx, meetingId, query),
  ]);

  return zoomParticipantsListResponseSchema.parse({
    data: {
      meetingId,
      topic: meta.topic,
      items: rows.map((row) => ({
        id: row.id,
        membershipId: row.membership_id,
        externalUserId: row.external_user_id,
        displayName: row.display_name,
        email: row.email,
        joinTime: row.join_time?.toISOString() ?? null,
        leaveTime: row.leave_time?.toISOString() ?? null,
        durationSeconds: row.duration_seconds,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}
