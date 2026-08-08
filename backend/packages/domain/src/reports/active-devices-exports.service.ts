import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  DEVICE_EXPORT_COLUMNS,
  activeDevicesExportsResponseSchema,
  createActiveDevicesExportBodySchema,
  createActiveDevicesExportResponseSchema,
  deleteDeviceExportScheduleResponseSchema,
  deviceExportRunDetailResponseSchema,
  retryActiveDevicesExportResponseSchema,
  updateDeviceExportScheduleBodySchema,
  updateDeviceExportScheduleResponseSchema,
  type CreateActiveDevicesExportBody,
} from "./active-devices-exports.dto";
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

const DEFINITION_KEY = "active-devices";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function estimateSizeLabel(rowCount: number | null, format: string): string | null {
  if (rowCount == null || rowCount < 0) return null;
  const perRow = format === "xlsx" ? 120 : format === "json" ? 180 : 64;
  return `~${formatBytes(Math.max(rowCount, 1) * perRow)}`;
}

function fileNameFor(createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "export"
    : date.toISOString().slice(0, 10);
  return `device-roster-${stamp}.${format === "json" ? "json" : format}`;
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  const parts: string[] = [];
  if (params["overLimitOnly"] === true) parts.push("Over device limit");
  const window = typeof params["window"] === "string" ? params["window"] : "all";
  if (window === "24h") parts.push("last 24 hours");
  else if (window === "7d") parts.push("last 7 days");
  else if (window === "30d") parts.push("last 30 days");
  else parts.push("all time");
  const platform = params["platform"];
  if (typeof platform === "string" && platform.trim()) {
    parts.push(platform.trim());
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the device roster artifact.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Active Devices report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

function cronFromCadence(cadence: "daily" | "weekly" | "monthly", time: string): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));
  if (cadence === "weekly") return `${minute} ${hour} * * 1`;
  if (cadence === "monthly") return `${minute} ${hour} 1 * *`;
  return `${minute} ${hour} * * *`;
}

function cadenceLabel(cron: string, timezone: string): string {
  const parts = cron.trim().split(/\s+/);
  const minute = parts[0] ?? "0";
  const hour = parts[1] ?? "0";
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (parts[4] && parts[4] !== "*") return `Every Monday, ${time} ${timezone}`;
  if (parts[2] && parts[2] !== "*") return `Monthly on day ${parts[2]}, ${time} ${timezone}`;
  return `Daily, ${time} ${timezone}`;
}

function nextRunLabel(nextRunAt: string): string {
  const date = new Date(nextRunAt);
  if (Number.isNaN(date.getTime())) return "Next run unknown";
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Due now";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 48) return `Next run in ${Math.max(1, hours)}h`;
  const days = Math.floor(hours / 24);
  return `Next run in ${days} day${days === 1 ? "" : "s"}`;
}

function mapHistoryItem(run: {
  id: string;
  format: string;
  params: Record<string, unknown>;
  rowCount: number | null;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  download?: { url: string; expiresAt: string } | null;
}) {
  return {
    id: run.id,
    fileName: fileNameFor(run.createdAt, run.format),
    format: run.format as "csv" | "xlsx" | "pdf" | "json",
    scopeLabel: scopeLabelFromParams(run.params),
    rowCount: run.rowCount,
    sizeLabel: estimateSizeLabel(run.rowCount, run.format),
    status: run.status,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    errorCode: run.errorCode,
    errorMessage: errorMessageFor(run.errorCode),
    downloadAvailable: run.status === "SUCCEEDED",
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
  delivery: Record<string, unknown> | null;
}) {
  const delivery = schedule.delivery ?? {};
  const recipients = Array.isArray(delivery["emails"])
    ? delivery["emails"].filter((item): item is string => typeof item === "string")
    : [];
  const webhookUrl = typeof delivery["webhookUrl"] === "string" ? delivery["webhookUrl"] : null;
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || "Device export",
    cadenceLabel: cadenceLabel(schedule.cronExpression, schedule.timezone),
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    formats: schedule.formats,
    isActive: schedule.isActive,
    nextRunAt: schedule.nextRunAt,
    nextRunLabel: nextRunLabel(schedule.nextRunAt),
    recipients,
    webhookLabel: webhookUrl ? "SIEM Ingest" : null,
    delivery: schedule.delivery,
  };
}

export async function getActiveDevicesExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
  ]);

  const history = runs.data.items.map((run) =>
    mapHistoryItem({
      id: run.id,
      format: run.format,
      params: run.params,
      rowCount: run.rowCount,
      status: run.status,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      errorCode: run.errorCode,
    }),
  );

  const deviceSchedules = schedules.data.items
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
        delivery: item.delivery,
      }),
    );

  return activeDevicesExportsResponseSchema.parse({
    data: {
      history,
      schedules: deviceSchedules,
      columns: DEVICE_EXPORT_COLUMNS.map((column) => ({ ...column })),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        canSchedule: true,
        canEmailDelivery: false,
        canWebhookDelivery: false,
        geoColumnsAvailable: false,
        note:
          "Exports generate from current device sessions. Email and webhook delivery settings are stored for schedules; delivery workers are not wired yet. City and country columns are unavailable without IP geolocation.",
      },
    },
  });
}

export async function createActiveDevicesExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateActiveDevicesExportBody,
) {
  const body = createActiveDevicesExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  const params: Record<string, unknown> = {
    columns: body.columns,
    window: body.window,
    overLimitOnly: body.overLimitOnly,
  };
  if (body.platform?.trim()) params["platform"] = body.platform.trim();
  if (body.delivery !== "download") {
    params["deliveryMode"] = body.delivery;
  }

  const runResult = await createReportRun(tx, ctx, {
    definitionKey: DEFINITION_KEY,
    format: body.format,
    params,
  });

  let schedule = null;
  if (body.scheduleEnabled) {
    const cadence = body.cadence ?? "weekly";
    const time = body.time ?? "07:00";
    const timezone = body.timezone ?? "UTC";
    const scheduleResult = await createReportSchedule(tx, ctx, {
      definitionKey: DEFINITION_KEY,
      name: body.scheduleName?.trim() || "Weekly device audit",
      cronExpression: cronFromCadence(cadence, time),
      timezone,
      params,
      formats: [body.format],
      delivery: {
        mode: body.delivery,
        emails: body.recipients ?? [],
        webhookUrl: body.webhookUrl ?? null,
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
      delivery: scheduleResult.data.delivery,
    });
  }

  return createActiveDevicesExportResponseSchema.parse({
    data: {
      run: mapHistoryItem({
        id: runResult.data.id,
        format: runResult.data.format,
        params: runResult.data.params,
        rowCount: runResult.data.rowCount,
        status: runResult.data.status,
        createdAt: runResult.data.createdAt,
        completedAt: runResult.data.completedAt,
        errorCode: runResult.data.errorCode,
      }),
      schedule,
    },
  });
}

export async function getActiveDevicesExportRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return deviceExportRunDetailResponseSchema.parse({
    data: mapHistoryItem({
      id: result.data.id,
      format: result.data.format,
      params: result.data.params,
      rowCount: result.data.rowCount,
      status: result.data.status,
      createdAt: result.data.createdAt,
      completedAt: result.data.completedAt,
      errorCode: result.data.errorCode,
      download: result.data.download,
    }),
  });
}

export async function retryActiveDevicesExport(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const existing = await getReportRun(tx, ctx, runId);
  if (existing.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }

  const runResult = await createReportRun(tx, ctx, {
    definitionKey: DEFINITION_KEY,
    format: existing.data.format === "pdf" ? "csv" : existing.data.format,
    params: existing.data.params,
  });

  return retryActiveDevicesExportResponseSchema.parse({
    data: mapHistoryItem({
      id: runResult.data.id,
      format: runResult.data.format,
      params: runResult.data.params,
      rowCount: runResult.data.rowCount,
      status: runResult.data.status,
      createdAt: runResult.data.createdAt,
      completedAt: runResult.data.completedAt,
      errorCode: runResult.data.errorCode,
    }),
  });
}

export async function updateActiveDevicesExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean; name?: string },
) {
  const body = updateDeviceExportScheduleBodySchema.parse(input);
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
  return updateDeviceExportScheduleResponseSchema.parse({
    data: mapScheduleItem({
      id: updated.data.id,
      name: updated.data.name,
      definitionTitle: updated.data.definitionTitle,
      cronExpression: updated.data.cronExpression,
      timezone: updated.data.timezone,
      formats: updated.data.formats,
      isActive: updated.data.isActive,
      nextRunAt: updated.data.nextRunAt,
      delivery: updated.data.delivery,
    }),
  });
}

export async function deleteActiveDevicesExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
) {
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
  return deleteDeviceExportScheduleResponseSchema.parse(deleted);
}
