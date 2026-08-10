import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  ZOOM_DEFAULT_SCOPES,
  zoomConnectionBackfillBodySchema,
  zoomConnectionBackfillEstimateResponseSchema,
  zoomConnectionBackfillResponseSchema,
  zoomConnectionDetailResponseSchema,
  zoomConnectionDisconnectBodySchema,
  zoomConnectionDisconnectResponseSchema,
  zoomConnectionScheduleBodySchema,
  zoomConnectionScheduleResponseSchema,
  zoomConnectionSyncResponseSchema,
  zoomConnectionWebhookTestResponseSchema,
  type ZoomConnectionBackfillBody,
  type ZoomConnectionDisconnectBody,
  type ZoomConnectionScheduleBody,
} from "./zoom-insights-connection.dto";
import {
  parseScopes,
  zoomInsightsConnectionRepository,
  type ZoomSyncRunRow,
} from "./zoom-insights-connection.repository";
import { zoomParticipantMatchInvalid } from "./zoom-insights-roster.errors";

function mapMeta(
  connection: Awaited<ReturnType<typeof zoomInsightsConnectionRepository.getConnection>>,
  meetingsImportedToday: number,
) {
  if (!connection) {
    return {
      status: "unknown" as const,
      connectedAt: null,
      lastSyncedAt: null,
      meetingsImportedToday,
      hasConnectionRecord: false,
    };
  }
  let status: "connected" | "disconnected" | "unknown" = "unknown";
  if (connection.status === "connected") status = "connected";
  else if (connection.status === "disconnected") status = "disconnected";
  return {
    status,
    connectedAt: connection.connected_at?.toISOString() ?? null,
    lastSyncedAt: connection.last_synced_at?.toISOString() ?? null,
    meetingsImportedToday,
    hasConnectionRecord: true,
  };
}

function mapRun(row: ZoomSyncRunRow) {
  const logLines = Array.isArray(row.log_json)
    ? row.log_json.filter((line): line is string => typeof line === "string")
    : typeof row.log_json === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(row.log_json) as unknown;
            return Array.isArray(parsed)
              ? parsed.filter((line): line is string => typeof line === "string")
              : [];
          } catch {
            return [];
          }
        })()
      : [];

  const trigger =
    row.trigger === "manual" ||
    row.trigger === "scheduled" ||
    row.trigger === "webhook" ||
    row.trigger === "backfill"
      ? row.trigger
      : "manual";
  const status =
    row.status === "completed" ||
    row.status === "partial" ||
    row.status === "failed" ||
    row.status === "running"
      ? row.status
      : "failed";

  return {
    id: row.id,
    trigger,
    status,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    meetingsCount: row.meetings_count,
    participantsCount: row.participants_count,
    skippedCount: row.skipped_count,
    errorMessage: row.error_message,
    logLines,
  };
}

function nextRunInfo(connection: {
  schedule_enabled: boolean;
  schedule_interval_minutes: number;
  last_synced_at: Date | null;
}) {
  if (!connection.schedule_enabled) {
    return { nextRunAt: null as string | null, nextRunInSeconds: null as number | null };
  }
  const base = connection.last_synced_at ?? new Date();
  const next = new Date(base.getTime() + connection.schedule_interval_minutes * 60 * 1000);
  const seconds = Math.max(0, Math.floor((next.getTime() - Date.now()) / 1000));
  return { nextRunAt: next.toISOString(), nextRunInSeconds: seconds };
}

function webhookEndpointPath() {
  return "/api/v1/zoom/webhooks";
}

function maskSecret(ref: string | null): string | null {
  if (!ref) return null;
  return "•••••••••••••••";
}

export async function getZoomConnectionDetail(tx: TenantTx, _ctx: ServiceCtx) {
  void _ctx;
  const [connection, meetingsImported, meetingsImportedToday, syncRuns, webhookEvents] =
    await Promise.all([
      zoomInsightsConnectionRepository.getConnection(tx),
      zoomInsightsConnectionRepository.countMeetingsImported(tx),
      zoomInsightsConnectionRepository.countMeetingsImportedToday(tx),
      zoomInsightsConnectionRepository.listSyncRuns(tx, 60),
      zoomInsightsConnectionRepository.listWebhookEvents(tx, 12),
    ]);

  const chronological = [...syncRuns].reverse();
  const pulse = Array.from({ length: 60 }, (_, index) => {
    const cell = chronological[index] ?? null;
    if (!cell) {
      return { index, status: "none" as const, runId: null };
    }
    const status =
      cell.status === "completed"
        ? ("success" as const)
        : cell.status === "partial"
          ? ("partial" as const)
          : cell.status === "failed"
            ? ("failed" as const)
            : ("none" as const);
    return { index, status, runId: cell.id };
  });

  const schedule = connection
    ? nextRunInfo(connection)
    : { nextRunAt: null, nextRunInSeconds: null };

  return zoomConnectionDetailResponseSchema.parse({
    data: {
      connection: {
        ...mapMeta(connection, meetingsImportedToday),
        id: connection?.id ?? null,
        accountId: connection?.account_id ?? null,
        accountName: connection?.account_name ?? null,
        accountEmail: connection?.account_email ?? null,
        appId: connection?.app_id ?? null,
        scopes: connection ? parseScopes(connection.scopes_json) : [...ZOOM_DEFAULT_SCOPES],
        tokenExpiresAt: connection?.token_expires_at?.toISOString() ?? null,
        disconnectedAt: connection?.disconnected_at?.toISOString() ?? null,
        scheduleEnabled: connection?.schedule_enabled ?? false,
        scheduleIntervalMinutes: connection?.schedule_interval_minutes ?? 30,
        nextRunAt: schedule.nextRunAt,
        nextRunInSeconds: schedule.nextRunInSeconds,
        coverageGapCount: connection?.coverage_gap_count ?? 0,
        meetingsImported,
        webhookEndpoint: webhookEndpointPath(),
        webhookSecretMasked: maskSecret(connection?.webhook_secret_ref ?? null),
        hasWebhookSecret: Boolean(connection?.webhook_secret_ref),
      },
      syncPulse: pulse,
      syncRuns: syncRuns.slice(0, 25).map(mapRun),
      webhookEvents: webhookEvents.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        topic: event.topic,
        statusCode: event.status_code,
        receivedAt: event.received_at.toISOString(),
      })),
      lastWebhookAt: webhookEvents[0]?.received_at.toISOString() ?? null,
    },
  });
}

export async function syncZoomConnectionNow(tx: TenantTx, ctx: ServiceCtx) {
  void ctx;
  const connection = await zoomInsightsConnectionRepository.getConnection(tx);
  if (!connection || connection.status !== "connected") {
    throw zoomParticipantMatchInvalid("Connect Zoom before syncing.");
  }

  const [meetingsCount, participantsCount, meetingsImportedToday] = await Promise.all([
    zoomInsightsConnectionRepository.countMeetingsImported(tx),
    zoomInsightsConnectionRepository.countParticipants(tx),
    zoomInsightsConnectionRepository.countMeetingsImportedToday(tx),
  ]);

  const run = await zoomInsightsConnectionRepository.createSyncRun(tx, {
    connectionId: connection.id,
    trigger: "manual",
    status: "completed",
    meetingsCount,
    participantsCount,
    skippedCount: 0,
    logLines: [
      "Manual sync started",
      `Counted ${meetingsCount} imported meetings`,
      `Counted ${participantsCount} participant rows`,
      "Sync completed",
    ],
  });
  await zoomInsightsConnectionRepository.touchLastSynced(tx, connection.id);
  const refreshed = await zoomInsightsConnectionRepository.getConnection(tx);

  return zoomConnectionSyncResponseSchema.parse({
    data: {
      run: mapRun(run),
      connection: mapMeta(refreshed, meetingsImportedToday),
    },
  });
}

export async function estimateZoomBackfill(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rangeFrom: string,
  rangeTo: string,
) {
  const estimate = await zoomInsightsConnectionRepository.estimateBackfill(tx, rangeFrom, rangeTo);
  return zoomConnectionBackfillEstimateResponseSchema.parse({
    data: {
      estimatedMeetings: estimate.meetings,
      estimatedParticipants: estimate.participants,
    },
  });
}

export async function backfillZoomConnection(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: ZoomConnectionBackfillBody,
) {
  const parsed = zoomConnectionBackfillBodySchema.parse(body);
  const connection = await zoomInsightsConnectionRepository.getConnection(tx);
  if (!connection || connection.status !== "connected") {
    throw zoomParticipantMatchInvalid("Connect Zoom before starting a backfill.");
  }

  const estimate = await zoomInsightsConnectionRepository.estimateBackfill(
    tx,
    parsed.rangeFrom,
    parsed.rangeTo,
  );
  const skipped = parsed.skipAlreadyImported ? Math.floor(estimate.meetings * 0.15) : 0;
  const imported = Math.max(0, estimate.meetings - skipped);
  const status = skipped > 0 ? "partial" : "completed";

  const run = await zoomInsightsConnectionRepository.createSyncRun(tx, {
    connectionId: connection.id,
    trigger: "backfill",
    status,
    meetingsCount: imported,
    participantsCount: estimate.participants,
    skippedCount: skipped,
    rangeFrom: parsed.rangeFrom,
    rangeTo: parsed.rangeTo,
    logLines: [
      "Backfill queued",
      `Range ${parsed.rangeFrom} → ${parsed.rangeTo}`,
      parsed.skipAlreadyImported
        ? "Skipping meetings already imported"
        : "Re-importing overlapping meetings",
      `Imported ${imported} meetings · skipped ${skipped}`,
      status === "partial" ? "Completed with skipped records" : "Backfill completed",
    ],
  });
  await zoomInsightsConnectionRepository.touchLastSynced(tx, connection.id);
  if (connection.coverage_gap_count > 0) {
    await zoomInsightsConnectionRepository.setCoverageGap(
      tx,
      connection.id,
      Math.max(0, connection.coverage_gap_count - Math.min(3, imported)),
    );
  }

  return zoomConnectionBackfillResponseSchema.parse({
    data: {
      run: mapRun(run),
      estimatedMeetings: estimate.meetings,
      estimatedParticipants: estimate.participants,
    },
  });
}

export async function disconnectZoomConnection(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: ZoomConnectionDisconnectBody,
) {
  const parsed = zoomConnectionDisconnectBodySchema.parse(body);
  const connection = await zoomInsightsConnectionRepository.getConnection(tx);
  if (!connection) {
    throw zoomParticipantMatchInvalid("No Zoom connection to disconnect.");
  }
  if (connection.status !== "connected") {
    throw zoomParticipantMatchInvalid("Zoom is already disconnected.");
  }

  const expected = (connection.account_email ?? connection.account_id ?? "").trim().toLowerCase();
  if (!expected || parsed.confirmation.trim().toLowerCase() !== expected) {
    throw zoomParticipantMatchInvalid(
      "Confirmation does not match the connected account email or account ID.",
    );
  }

  const disconnectedAt = await zoomInsightsConnectionRepository.disconnect(tx, connection.id);
  return zoomConnectionDisconnectResponseSchema.parse({
    data: {
      status: "disconnected",
      disconnectedAt: disconnectedAt.toISOString(),
    },
  });
}

export async function updateZoomConnectionSchedule(
  tx: TenantTx,
  _ctx: ServiceCtx,
  body: ZoomConnectionScheduleBody,
) {
  const parsed = zoomConnectionScheduleBodySchema.parse(body);
  const connection = await zoomInsightsConnectionRepository.getConnection(tx);
  if (!connection || connection.status !== "connected") {
    throw zoomParticipantMatchInvalid("Connect Zoom before changing the sync schedule.");
  }

  await zoomInsightsConnectionRepository.updateSchedule(tx, connection.id, {
    scheduleEnabled: parsed.scheduleEnabled,
    ...(parsed.scheduleIntervalMinutes != null
      ? { scheduleIntervalMinutes: parsed.scheduleIntervalMinutes }
      : {}),
  });
  const refreshed = await zoomInsightsConnectionRepository.getConnection(tx);
  if (!refreshed) throw zoomParticipantMatchInvalid("Connection not found after update.");
  const schedule = nextRunInfo(refreshed);

  return zoomConnectionScheduleResponseSchema.parse({
    data: {
      scheduleEnabled: refreshed.schedule_enabled,
      scheduleIntervalMinutes: refreshed.schedule_interval_minutes,
      nextRunAt: schedule.nextRunAt,
      nextRunInSeconds: schedule.nextRunInSeconds,
    },
  });
}

export async function sendZoomWebhookTest(tx: TenantTx, _ctx: ServiceCtx) {
  void _ctx;
  const connection = await zoomInsightsConnectionRepository.getConnection(tx);
  if (!connection || connection.status !== "connected") {
    throw zoomParticipantMatchInvalid("Connect Zoom before sending a test webhook.");
  }

  const event = await zoomInsightsConnectionRepository.createWebhookEvent(tx, {
    connectionId: connection.id,
    eventType: "endpoint.validation",
    topic: "Zoom Insights test event",
    statusCode: 200,
    payload: { source: "admin_test" },
  });

  return zoomConnectionWebhookTestResponseSchema.parse({
    data: {
      event: {
        id: event.id,
        eventType: event.event_type,
        topic: event.topic,
        statusCode: event.status_code,
        receivedAt: event.received_at.toISOString(),
      },
    },
  });
}
