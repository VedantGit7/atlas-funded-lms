import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  checkInAttendanceBodySchema,
  checkInAttendanceResponseSchema,
  createLiveSessionBodySchema,
  liveAttendanceListResponseSchema,
  liveSessionListResponseSchema,
  liveSessionResponseSchema,
  updateLiveSessionBodySchema,
} from "./live.dto";
import { liveSessionNotFound } from "./live.errors";
import { liveRepository, type LiveAttendanceRow, type LiveSessionRow } from "./live.repository";

function toSessionDto(row: LiveSessionRow) {
  return {
    id: row.id,
    title: row.title,
    courseId: row.course_id,
    status: row.status,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    metadataJson: row.metadata_json ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function toAttendanceDto(row: LiveAttendanceRow) {
  return {
    id: row.id,
    liveSessionId: row.live_session_id,
    membershipId: row.membership_id,
    status: row.status,
    joinedAt: row.joined_at?.toISOString() ?? null,
    leftAt: row.left_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
  };
}

export async function createLiveSession(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createLiveSessionBodySchema.parse(rawBody);
  const row = await liveRepository.insertSession(tx, {
    title: body.title,
    courseId: body.courseId ?? null,
    status: body.status,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    metadataJson: body.metadataJson,
  });
  return liveSessionResponseSchema.parse({ data: toSessionDto(row) });
}

export async function listLiveSessions(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await liveRepository.listSessions(tx);
  return liveSessionListResponseSchema.parse({ data: { items: rows.map(toSessionDto) } });
}

export async function getLiveSession(tx: TenantTx, _ctx: ServiceCtx, sessionId: string) {
  const row = await liveRepository.findSessionById(tx, sessionId);
  if (!row) throw liveSessionNotFound();
  return liveSessionResponseSchema.parse({ data: toSessionDto(row) });
}

export async function updateLiveSession(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
  rawBody: unknown,
) {
  const body = updateLiveSessionBodySchema.parse(rawBody);
  const row = await liveRepository.updateSession(tx, sessionId, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.scheduledAt !== undefined
      ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }
      : {}),
    ...(body.startedAt !== undefined
      ? { startedAt: body.startedAt ? new Date(body.startedAt) : null }
      : {}),
    ...(body.endedAt !== undefined ? { endedAt: body.endedAt ? new Date(body.endedAt) : null } : {}),
    ...(body.metadataJson !== undefined ? { metadataJson: body.metadataJson } : {}),
  });
  if (!row) throw liveSessionNotFound();
  return liveSessionResponseSchema.parse({ data: toSessionDto(row) });
}

export async function deleteLiveSession(tx: TenantTx, _ctx: ServiceCtx, sessionId: string) {
  const deleted = await liveRepository.deleteSession(tx, sessionId);
  if (!deleted) throw liveSessionNotFound();
  return { data: { deleted: true } };
}

export async function checkInLiveAttendance(
  tx: TenantTx,
  ctx: ServiceCtx,
  sessionId: string,
  rawBody: unknown,
) {
  const body = checkInAttendanceBodySchema.parse(rawBody);
  const session = await liveRepository.findSessionById(tx, sessionId);
  if (!session) throw liveSessionNotFound();

  const row = await liveRepository.checkIn(tx, {
    sessionId,
    membershipId: ctx.actorMembershipId,
    status: body.status,
  });

  await liveRepository.refreshSessionInsights(tx, sessionId);

  return checkInAttendanceResponseSchema.parse({ data: toAttendanceDto(row) });
}

export async function listLiveAttendance(tx: TenantTx, _ctx: ServiceCtx, sessionId: string) {
  const session = await liveRepository.findSessionById(tx, sessionId);
  if (!session) throw liveSessionNotFound();

  const rows = await liveRepository.listAttendance(tx, sessionId);
  return liveAttendanceListResponseSchema.parse({ data: { items: rows.map(toAttendanceDto) } });
}
