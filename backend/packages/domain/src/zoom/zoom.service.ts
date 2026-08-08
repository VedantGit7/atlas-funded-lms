import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  connectZoomBodySchema,
  connectZoomResponseSchema,
  listZoomMeetingsResponseSchema,
  zoomWebhookBodySchema,
  zoomWebhookResponseSchema,
} from "./zoom.dto";
import { zoomNotConnected } from "./zoom.errors";
import { zoomRepository } from "./zoom.repository";

export async function connectZoom(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = connectZoomBodySchema.parse(rawBody);
  const row = await zoomRepository.upsertConnection(tx, {
    accountId: body.accountId ?? null,
    accessTokenRef: body.accessTokenRef ?? null,
    refreshTokenRef: body.refreshTokenRef ?? null,
  });

  return connectZoomResponseSchema.parse({
    data: {
      id: row.id,
      accountId: row.account_id,
      status: row.status,
      connectedAt: row.connected_at?.toISOString() ?? null,
    },
  });
}

export async function listZoomMeetings(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await zoomRepository.listMeetings(tx);
  return listZoomMeetingsResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        externalMeetingId: row.external_meeting_id,
        topic: row.topic,
        startedAt: row.started_at?.toISOString() ?? null,
        endedAt: row.ended_at?.toISOString() ?? null,
      })),
    },
  });
}

export async function handleZoomWebhook(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = zoomWebhookBodySchema.parse(rawBody);
  const connection = await zoomRepository.getConnection(tx);
  if (!connection) throw zoomNotConnected();

  const result = await zoomRepository.upsertMeetingFromWebhook(tx, {
    connectionId: connection.id,
    externalMeetingId: body.externalMeetingId,
    topic: body.topic ?? null,
    startedAt: body.startedAt ? new Date(body.startedAt) : null,
    endedAt: body.endedAt ? new Date(body.endedAt) : null,
    ...(body.participants
      ? {
          participants: body.participants.map((participant) => ({
            ...(participant.externalUserId ? { externalUserId: participant.externalUserId } : {}),
            ...(participant.displayName ? { displayName: participant.displayName } : {}),
            joinTime: participant.joinTime ? new Date(participant.joinTime) : null,
            leaveTime: participant.leaveTime ? new Date(participant.leaveTime) : null,
            durationSeconds: participant.durationSeconds ?? null,
          })),
        }
      : {}),
  });

  return zoomWebhookResponseSchema.parse({
    data: {
      meetingId: result.meetingId,
      participantCount: result.participantCount,
    },
  });
}
