import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  DEVICE_EXPORT_COLUMNS,
  activeDevicesExportsResponseSchema,
  createActiveDevicesExportBodySchema,
  createActiveDevicesExportResponseSchema,
  deviceExportRunDetailResponseSchema,
  retryActiveDevicesExportResponseSchema,
  updateDeviceExportScheduleResponseSchema,
  type CreateActiveDevicesExportBody,
} from "./active-devices-exports.dto";
import {
  createReportRun,
  createReportSchedule,
  ensureTenantReportDefinitions,
  listReportRuns,
  listReportSchedules,
} from "./reports.service";
import {
  cadenceLabel,
  createExportOperations,
  cronFromCadence,
  estimateSizeLabel,
  nextRunLabel,
  type ExportRun,
  type ExportScheduleView,
} from "./report-exports.kit";
import {
  deleteReportExportScheduleResponseSchema,
  updateReportExportScheduleBodySchema,
} from "./report-exports.dto";

const DEFINITION_KEY = "active-devices";

function fileNameFor(createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
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

/** Device exports have no datasets, so their history and schedule rows are their own. */
function mapHistoryItem(run: ExportRun) {
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

function mapScheduleItem(schedule: Omit<ExportScheduleView, "params">) {
  const delivery = schedule.delivery ?? {};
  const recipients = Array.isArray(delivery["emails"])
    ? delivery["emails"].filter((item): item is string => typeof item === "string")
    : [];
  const webhookUrl = typeof delivery["webhookUrl"] === "string" ? delivery["webhookUrl"] : null;
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || "Device export",
    cadenceLabel: cadenceLabel(schedule.cronExpression, schedule.timezone, "comma"),
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

const operations = createExportOperations({
  definitionKey: DEFINITION_KEY,
  describeRun: mapHistoryItem,
  describeSchedule: mapScheduleItem,
  retryProcessInline: true,
  schemas: {
    runDetail: deviceExportRunDetailResponseSchema,
    retry: retryActiveDevicesExportResponseSchema,
    updateScheduleBody: updateReportExportScheduleBodySchema,
    updateSchedule: updateDeviceExportScheduleResponseSchema,
    deleteSchedule: deleteReportExportScheduleResponseSchema,
  },
});

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
        note: "Exports generate from current device sessions. Email and webhook delivery settings are stored for schedules; delivery workers are not wired yet. City and country columns are unavailable without IP geolocation.",
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

export const getActiveDevicesExportRun = operations.getRun;
export const retryActiveDevicesExport = operations.retry;
export const updateActiveDevicesExportSchedule = operations.updateSchedule;
export const deleteActiveDevicesExportSchedule = operations.deleteSchedule;
