import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  ZOOM_EXPORT_DATASETS,
  createZoomExportBodySchema,
  createZoomExportResponseSchema,
  deleteZoomExportScheduleResponseSchema,
  retryZoomExportResponseSchema,
  updateZoomExportScheduleBodySchema,
  updateZoomExportScheduleResponseSchema,
  zoomExportRunDetailResponseSchema,
  zoomInsightsExportsResponseSchema,
  type CreateZoomExportBody,
} from "./zoom-insights-exports.dto";
import {
  createReportRun,
  createReportSchedule,
  deleteReportSchedule,
  ensureTenantReportDefinitions,
  getReportRun,
  listReportRuns,
  listReportSchedules,
  updateReportSchedule,
} from "./reports.service";
import { zoomInsightsRosterRepository } from "./zoom-insights-roster.repository";

const DEFINITION_KEY = "zoom-insights";

type ZoomExportDataset = (typeof ZOOM_EXPORT_DATASETS)[number];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)}B`;
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function estimateSizeLabel(rowCount: number | null, format: string): string | null {
  if (rowCount == null || rowCount < 0) return null;
  const perRow = format === "xlsx" ? 120 : format === "json" ? 180 : 64;
  return `~${formatBytes(Math.max(rowCount, 1) * perRow)}`;
}

function datasetLabel(dataset: ZoomExportDataset): string {
  if (dataset === "participants") return "Participants";
  if (dataset === "unmatched") return "Unmatched";
  if (dataset === "connection") return "Connection";
  return "Meetings";
}

function normalizeDataset(value: unknown): ZoomExportDataset {
  if (typeof value === "string" && (ZOOM_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as ZoomExportDataset;
  }
  return "meetings";
}

function fileNameFor(dataset: ZoomExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "export"
    : date.toISOString().slice(0, 10).replace(/-/g, "");
  const ext = format === "json" ? "json" : format;
  return `zoom_${dataset}_${stamp}.${ext}`;
}

function formatDateShort(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function resolveDateRange(body: CreateZoomExportBody): {
  startedFrom?: string;
  startedTo?: string;
} {
  if (body.datePreset === "custom") {
    const range: { startedFrom?: string; startedTo?: string } = {};
    if (body.startedFrom) range.startedFrom = body.startedFrom;
    if (body.startedTo) range.startedTo = body.startedTo;
    return range;
  }
  const days = body.datePreset === "7d" ? 7 : body.datePreset === "90d" ? 90 : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { startedFrom: from.toISOString(), startedTo: to.toISOString() };
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  if (typeof params["filterSummary"] === "string" && params["filterSummary"].trim()) {
    return params["filterSummary"].trim();
  }
  const parts: string[] = [];
  const from = formatDateShort(
    typeof params["startedFrom"] === "string"
      ? params["startedFrom"]
      : typeof params["joinedFrom"] === "string"
        ? params["joinedFrom"]
        : undefined,
  );
  const to = formatDateShort(
    typeof params["startedTo"] === "string"
      ? params["startedTo"]
      : typeof params["joinedTo"] === "string"
        ? params["joinedTo"]
        : undefined,
  );
  if (from && to) parts.push(`${from} – ${to}`);
  else if (from) parts.push(`From ${from}`);
  else if (to) parts.push(`Until ${to}`);
  else parts.push("All time");

  if (typeof params["meetingId"] === "string" && params["meetingId"].trim()) {
    parts.push("1 meeting");
  } else if (params["allMeetingsInRange"] !== false) {
    parts.push("All meetings in range");
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export failed while assembling the Zoom payload. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Zoom Insights report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

function cronFromCadence(cadence: "daily" | "weekly" | "monthly", time: string): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));
  if (cadence === "weekly") return `${String(minute)} ${String(hour)} * * 1`;
  if (cadence === "monthly") return `${String(minute)} ${String(hour)} 1 * *`;
  return `${String(minute)} ${String(hour)} * * *`;
}

function cadenceLabel(cron: string, timezone: string): string {
  const parts = cron.trim().split(/\s+/);
  const minute = parts[0] ?? "0";
  const hour = parts[1] ?? "0";
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (parts[4] && parts[4] !== "*") return `Every Monday at ${time} ${timezone}`;
  if (parts[2] && parts[2] !== "*") return `1st of every month at ${time} ${timezone}`;
  return `Daily at ${time} ${timezone}`;
}

function nextRunLabel(nextRunAt: string): string {
  const date = new Date(nextRunAt);
  if (Number.isNaN(date.getTime())) return "Next run unknown";
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Due now";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 48) return `Next run in ${String(Math.max(1, hours))}h`;
  const days = Math.floor(hours / 24);
  return `Next run in ${String(days)} day${days === 1 ? "" : "s"}`;
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

function requesterLabel(
  membershipId: string | null | undefined,
  actorMembershipId: string,
  scheduleId: string | null | undefined,
): string {
  if (scheduleId) return "System";
  if (membershipId && membershipId === actorMembershipId) return "You";
  if (membershipId) return "Admin";
  return "System";
}

function mapConnection(
  connection: Awaited<ReturnType<typeof zoomInsightsRosterRepository.getConnectionMeta>>,
) {
  return {
    status: connection.status,
    connectedAt: connection.connected_at?.toISOString() ?? null,
    lastSyncedAt: connection.last_synced_at?.toISOString() ?? null,
    meetingsImportedToday: connection.meetings_imported_today,
    hasConnectionRecord: connection.has_connection_record,
  };
}

function mapHistoryItem(
  run: {
    id: string;
    format: string;
    params: Record<string, unknown>;
    rowCount: number | null;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    createdAt: string;
    completedAt: string | null;
    expiresAt?: string | null;
    errorCode: string | null;
    errorMessage?: string | null;
    errorTrace?: string[] | null;
    progressPercent?: number | null;
    download?: { url: string; expiresAt: string } | null;
    requestedByMembershipId?: string | null;
    scheduleId?: string | null;
  },
  actorMembershipId: string,
) {
  const dataset = normalizeDataset(run.params["dataset"] ?? run.params["reportTab"]);
  const expiresAt = run.expiresAt ?? run.download?.expiresAt ?? null;
  const expired = run.status === "SUCCEEDED" && isExpired(expiresAt);
  const resolvedMessage =
    typeof run.errorMessage === "string" && run.errorMessage.trim()
      ? run.errorMessage
      : errorMessageFor(run.errorCode);
  return {
    id: run.id,
    fileName: fileNameFor(dataset, run.createdAt, run.format),
    format: run.format as "csv" | "xlsx" | "pdf" | "json",
    dataset,
    datasetLabel: datasetLabel(dataset),
    scopeLabel: scopeLabelFromParams(run.params),
    rowCount: run.rowCount,
    sizeLabel: estimateSizeLabel(run.rowCount, run.format),
    requestedByLabel: requesterLabel(
      run.requestedByMembershipId,
      actorMembershipId,
      run.scheduleId,
    ),
    status: run.status,
    expired,
    expiresAt,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    errorCode: run.errorCode,
    errorMessage: resolvedMessage,
    errorTrace: run.errorTrace ?? null,
    progressPercent: run.progressPercent ?? null,
    downloadAvailable: run.status === "SUCCEEDED" && !expired,
  };
}

function mapScheduleItem(schedule: {
  id: string;
  name: string | null;
  definitionTitle: string;
  cronExpression: string;
  timezone: string;
  formats: Array<"csv" | "xlsx" | "pdf" | "json">;
  isActive: boolean;
  nextRunAt: string;
  params: Record<string, unknown>;
  delivery: Record<string, unknown> | null;
}) {
  const delivery = schedule.delivery ?? {};
  const recipients = Array.isArray(delivery["emails"])
    ? delivery["emails"].filter((item): item is string => typeof item === "string")
    : [];
  const dataset = normalizeDataset(schedule.params["dataset"] ?? schedule.params["reportTab"]);
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || "Zoom export",
    dataset,
    datasetLabel: datasetLabel(dataset),
    cadenceLabel: cadenceLabel(schedule.cronExpression, schedule.timezone),
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    formats: schedule.formats,
    isActive: schedule.isActive,
    nextRunAt: schedule.nextRunAt,
    nextRunLabel: nextRunLabel(schedule.nextRunAt),
    recipients,
    delivery: schedule.delivery,
  };
}

function buildRunParams(body: CreateZoomExportBody): Record<string, unknown> {
  const range = resolveDateRange(body);
  const params: Record<string, unknown> = {
    dataset: body.dataset,
    reportTab: body.dataset,
    allMeetingsInRange: body.allMeetingsInRange,
    datePreset: body.datePreset,
  };
  if (range.startedFrom) {
    params["startedFrom"] = range.startedFrom;
    params["joinedFrom"] = range.startedFrom;
  }
  if (range.startedTo) {
    params["startedTo"] = range.startedTo;
    params["joinedTo"] = range.startedTo;
  }
  if (!body.allMeetingsInRange && body.meetingId) {
    params["meetingId"] = body.meetingId;
    params["allMeetingsInRange"] = false;
  }
  if (body.filterSummary?.trim()) params["filterSummary"] = body.filterSummary.trim();
  if (body.delivery === "email_me") {
    params["emailDownloadLink"] = true;
    params["deliveryMode"] = "email_me";
  } else {
    params["deliveryMode"] = "download";
  }
  return params;
}

export async function getZoomInsightsExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules, connection] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
    zoomInsightsRosterRepository.getConnectionMeta(tx),
  ]);

  const history = runs.data.items.map((run) =>
    mapHistoryItem(
      {
        id: run.id,
        format: run.format,
        params: run.params,
        rowCount: run.rowCount,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        expiresAt: run.expiresAt,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        errorTrace: run.errorTrace,
        progressPercent: run.progressPercent,
        requestedByMembershipId: run.requestedByMembershipId,
        scheduleId: run.scheduleId,
      },
      ctx.actorMembershipId,
    ),
  );

  const zoomSchedules = schedules.data.items
    .filter((item) => item.definitionKey === DEFINITION_KEY)
    .map((item) =>
      mapScheduleItem({
        id: item.id,
        name: item.name,
        definitionTitle: item.definitionTitle,
        cronExpression: item.cronExpression,
        timezone: item.timezone,
        formats: item.formats,
        isActive: item.isActive,
        nextRunAt: item.nextRunAt,
        params: item.params,
        delivery: item.delivery,
      }),
    );

  return zoomInsightsExportsResponseSchema.parse({
    data: {
      history,
      schedules: zoomSchedules,
      connection: mapConnection(connection),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...ZOOM_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        note: "Ready files expire after the signed download TTL (typically 7 days). Meetings and participants share the Zoom Insights dataset with scope filters; unmatched and connection exports use dedicated row shapes.",
      },
    },
  });
}

export async function createZoomExport(tx: TenantTx, ctx: ServiceCtx, input: CreateZoomExportBody) {
  const body = createZoomExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.scheduleEnabled && body.delivery === "email_me") {
    // recipients optional — schedule can email the requesting admin later
  }

  const params = buildRunParams(body);

  const runResult = await createReportRun(
    tx,
    ctx,
    {
      definitionKey: DEFINITION_KEY,
      format: body.format,
      params,
    },
    { processInline: true },
  );

  let schedule = null;
  if (body.scheduleEnabled) {
    const cadence = body.cadence ?? "weekly";
    const time = body.time ?? "09:00";
    const timezone = body.timezone ?? "UTC";
    const scheduleResult = await createReportSchedule(tx, ctx, {
      definitionKey: DEFINITION_KEY,
      name: body.scheduleName?.trim() || `Weekly ${datasetLabel(body.dataset)} export`,
      cronExpression: cronFromCadence(cadence, time),
      timezone,
      params,
      formats: [body.format],
      delivery: {
        mode: body.delivery,
        emails: body.recipients ?? [],
      },
      isActive: true,
    });
    schedule = mapScheduleItem({
      id: scheduleResult.data.id,
      name: scheduleResult.data.name,
      definitionTitle: scheduleResult.data.definitionTitle,
      cronExpression: scheduleResult.data.cronExpression,
      timezone: scheduleResult.data.timezone,
      formats: scheduleResult.data.formats,
      isActive: scheduleResult.data.isActive,
      nextRunAt: scheduleResult.data.nextRunAt,
      params: scheduleResult.data.params,
      delivery: scheduleResult.data.delivery,
    });
  }

  return createZoomExportResponseSchema.parse({
    data: {
      run: mapHistoryItem(
        {
          id: runResult.data.id,
          format: runResult.data.format,
          params: runResult.data.params,
          rowCount: runResult.data.rowCount,
          status: runResult.data.status,
          createdAt: runResult.data.createdAt,
          completedAt: runResult.data.completedAt,
          expiresAt: runResult.data.expiresAt,
          errorCode: runResult.data.errorCode,
          errorMessage: runResult.data.errorMessage,
          errorTrace: runResult.data.errorTrace,
          progressPercent: runResult.data.progressPercent,
          requestedByMembershipId: runResult.data.requestedByMembershipId,
          scheduleId: runResult.data.scheduleId,
        },
        ctx.actorMembershipId,
      ),
      schedule,
    },
  });
}

export async function getZoomExportRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return zoomExportRunDetailResponseSchema.parse({
    data: mapHistoryItem(
      {
        id: result.data.id,
        format: result.data.format,
        params: result.data.params,
        rowCount: result.data.rowCount,
        status: result.data.status,
        createdAt: result.data.createdAt,
        completedAt: result.data.completedAt,
        expiresAt: result.data.expiresAt,
        errorCode: result.data.errorCode,
        errorMessage: result.data.errorMessage,
        errorTrace: result.data.errorTrace,
        progressPercent: result.data.progressPercent,
        download: result.data.download,
        requestedByMembershipId: result.data.requestedByMembershipId,
        scheduleId: result.data.scheduleId,
      },
      ctx.actorMembershipId,
    ),
  });
}

export async function retryZoomExport(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const existing = await getReportRun(tx, ctx, runId);
  if (existing.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }

  const runResult = await createReportRun(
    tx,
    ctx,
    {
      definitionKey: DEFINITION_KEY,
      format: existing.data.format === "pdf" ? "csv" : existing.data.format,
      params: existing.data.params,
    },
    { processInline: true },
  );

  return retryZoomExportResponseSchema.parse({
    data: mapHistoryItem(
      {
        id: runResult.data.id,
        format: runResult.data.format,
        params: runResult.data.params,
        rowCount: runResult.data.rowCount,
        status: runResult.data.status,
        createdAt: runResult.data.createdAt,
        completedAt: runResult.data.completedAt,
        expiresAt: runResult.data.expiresAt,
        errorCode: runResult.data.errorCode,
        errorMessage: runResult.data.errorMessage,
        errorTrace: runResult.data.errorTrace,
        progressPercent: runResult.data.progressPercent,
        requestedByMembershipId: runResult.data.requestedByMembershipId,
        scheduleId: runResult.data.scheduleId,
      },
      ctx.actorMembershipId,
    ),
  });
}

export async function updateZoomExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean | undefined; name?: string | undefined },
) {
  const body = updateZoomExportScheduleBodySchema.parse(input);
  const schedules = await listReportSchedules(tx, ctx);
  const existing = schedules.data.items.find((item) => item.id === scheduleId);
  if (!existing || existing.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Schedule was not found.",
    });
  }

  const updated = await updateReportSchedule(tx, ctx, scheduleId, body);
  return updateZoomExportScheduleResponseSchema.parse({
    data: mapScheduleItem({
      id: updated.data.id,
      name: updated.data.name,
      definitionTitle: updated.data.definitionTitle,
      cronExpression: updated.data.cronExpression,
      timezone: updated.data.timezone,
      formats: updated.data.formats,
      isActive: updated.data.isActive,
      nextRunAt: updated.data.nextRunAt,
      params: updated.data.params,
      delivery: updated.data.delivery,
    }),
  });
}

export async function deleteZoomExportSchedule(tx: TenantTx, ctx: ServiceCtx, scheduleId: string) {
  const schedules = await listReportSchedules(tx, ctx);
  const existing = schedules.data.items.find((item) => item.id === scheduleId);
  if (!existing || existing.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Schedule was not found.",
    });
  }
  const deleted = await deleteReportSchedule(tx, ctx, scheduleId);
  return deleteZoomExportScheduleResponseSchema.parse(deleted);
}
