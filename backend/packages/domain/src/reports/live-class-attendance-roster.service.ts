import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  liveAttendeesListResponseSchema,
  liveSessionDetailResponseSchema,
  liveSessionsListResponseSchema,
  type LiveAttendeesQuery,
  type LiveSessionsListQuery,
} from "./live-class-attendance-roster.dto";
import { liveClassSessionNotFound } from "./live-class-attendance-roster.errors";
import {
  liveClassAttendanceRosterRepository,
  type LiveAttendeesFilter,
  type LiveSessionListRow,
} from "./live-class-attendance-roster.repository";

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

function mapSessionListItem(row: LiveSessionListRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    courseId: row.course_id,
    courseTitle: row.course_title,
    batchId: row.batch_id,
    batchName: row.batch_name,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    attendanceCount: row.attendance_count,
    registeredCount: row.registered_count,
  };
}

function toAttendeeFilter(
  sessionId: string,
  input: Partial<{
    learnerName?: string;
    email?: string;
    status?: string;
    joinedFrom?: string;
    joinedTo?: string;
  }>,
): LiveAttendeesFilter {
  const filter: LiveAttendeesFilter = { sessionId };
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.email) filter.email = input.email;
  if (input.status) filter.status = input.status;
  if (input.joinedFrom) filter.joinedFrom = input.joinedFrom;
  if (input.joinedTo) filter.joinedTo = input.joinedTo;
  return filter;
}

export async function listLiveClassAttendanceSessions(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: LiveSessionsListQuery,
) {
  const [totalCount, rows] = await Promise.all([
    liveClassAttendanceRosterRepository.countSessions(tx, query),
    liveClassAttendanceRosterRepository.listSessions(tx, query),
  ]);

  return liveSessionsListResponseSchema.parse({
    data: {
      items: rows.map(mapSessionListItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getLiveClassSessionDetailedReport(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const totals = await liveClassAttendanceRosterRepository.sessionAttendanceTotals(
    tx,
    sessionId,
  );

  return liveSessionDetailResponseSchema.parse({
    data: {
      ...mapSessionListItem(meta),
      totalAttendanceSeconds: totals.totalAttendanceSeconds,
      avgDurationSeconds: totals.avgDurationSeconds,
    },
  });
}

export async function listLiveClassSessionAttendees(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
  query: LiveAttendeesQuery,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const filter = toAttendeeFilter(sessionId, {
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.email ? { email: query.email } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.joinedFrom ? { joinedFrom: query.joinedFrom } : {}),
    ...(query.joinedTo ? { joinedTo: query.joinedTo } : {}),
  });

  const [totalCount, rows] = await Promise.all([
    liveClassAttendanceRosterRepository.countAttendees(tx, filter),
    liveClassAttendanceRosterRepository.listAttendees(tx, sessionId, query),
  ]);

  return liveAttendeesListResponseSchema.parse({
    data: {
      sessionId,
      sessionTitle: meta.title,
      items: rows.map((row) => ({
        id: row.id,
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        status: row.status,
        joinedAt: row.joined_at?.toISOString() ?? null,
        leftAt: row.left_at?.toISOString() ?? null,
        durationSeconds: row.duration_seconds,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}
