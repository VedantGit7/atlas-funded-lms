import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { zoomInsightsConnectionRepository } from "../reports/zoom-insights-connection.repository";
import { zoomInsightsUnmatchedRepository } from "../reports/zoom-insights-unmatched.repository";
import { bulkMatchZoomUnmatched } from "../reports/zoom-insights-unmatched.service";
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
    accountName: body.accountName ?? null,
    accountEmail: body.accountEmail ?? null,
    appId: body.appId ?? null,
    accessTokenRef: body.accessTokenRef ?? null,
    refreshTokenRef: body.refreshTokenRef ?? null,
  });

  await zoomInsightsConnectionRepository.createSyncRun(tx, {
    connectionId: row.id,
    trigger: "manual",
    status: "completed",
    meetingsCount: 0,
    participantsCount: 0,
    logLines: ["Zoom account connected", "Initial connection health check passed"],
  });
  await zoomInsightsConnectionRepository.touchLastSynced(tx, row.id);

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
  void _ctx;
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
            ...(participant.email ? { email: participant.email } : {}),
            joinTime: participant.joinTime ? new Date(participant.joinTime) : null,
            leaveTime: participant.leaveTime ? new Date(participant.leaveTime) : null,
            durationSeconds: participant.durationSeconds ?? null,
          })),
        }
      : {}),
  });

  await zoomInsightsConnectionRepository.createWebhookEvent(tx, {
    connectionId: connection.id,
    eventType: body.endedAt ? "meeting.ended" : "meeting.updated",
    topic: body.topic ?? body.externalMeetingId,
    statusCode: 200,
    payload: { externalMeetingId: body.externalMeetingId },
  });

  await zoomInsightsConnectionRepository.createSyncRun(tx, {
    connectionId: connection.id,
    trigger: "webhook",
    status: "completed",
    meetingsCount: 1,
    participantsCount: result.participantCount,
    logLines: [
      `Webhook received for ${body.externalMeetingId}`,
      `Upserted meeting with ${result.participantCount} participants`,
    ],
  });
  await zoomInsightsConnectionRepository.touchLastSynced(tx, connection.id);

  const rules = await zoomInsightsUnmatchedRepository.getMatchingRules(tx);
  if (rules.autoMatchHighConfidenceOnImport && rules.matchOnExactEmail) {
    try {
      await bulkMatchZoomUnmatched(tx, _ctx, {
        mode: "all_high",
        applyToOtherMeetings: true,
      });
    } catch {
      // Import should succeed even if auto-match finds nothing to apply.
    }
  }

  return zoomWebhookResponseSchema.parse({
    data: {
      meetingId: result.meetingId,
      participantCount: result.participantCount,
    },
  });
}
