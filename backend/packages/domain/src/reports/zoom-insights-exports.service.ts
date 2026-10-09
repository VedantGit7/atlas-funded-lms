import type { TenantTx } from "@atlas/db";
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
  ensureTenantReportDefinitions,
  listReportRuns,
  listReportSchedules,
} from "./reports.service";
import { zoomInsightsRosterRepository } from "./zoom-insights-roster.repository";
import {
  createExportOperations,
  cronFromCadence,
  describeExportRun,
  describeExportSchedule,
  formatDateShort,
  type ExportRun,
  type ExportScheduleView,
  type ExportViewSpec,
} from "./report-exports.kit";

const DEFINITION_KEY = "zoom-insights";

type ZoomExportDataset = (typeof ZOOM_EXPORT_DATASETS)[number];

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

const view: ExportViewSpec<ZoomExportDataset> = {
  datasetParams: ["dataset", "reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: false,
  defaultScheduleName: "Zoom export",
  cadenceWording: "at",
  scheduleDataset: true,
  webhookLabel: null,
};

function mapHistoryItem(run: ExportRun, actorMembershipId = "") {
  return describeExportRun(view, run, actorMembershipId);
}

function mapScheduleItem(schedule: ExportScheduleView) {
  return describeExportSchedule(view, schedule);
}

const operations = createExportOperations({
  definitionKey: DEFINITION_KEY,
  describeRun: mapHistoryItem,
  describeSchedule: mapScheduleItem,
  retryProcessInline: true,
  schemas: {
    runDetail: zoomExportRunDetailResponseSchema,
    retry: retryZoomExportResponseSchema,
    updateScheduleBody: updateZoomExportScheduleBodySchema,
    updateSchedule: updateZoomExportScheduleResponseSchema,
    deleteSchedule: deleteZoomExportScheduleResponseSchema,
  },
});

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

export const getZoomExportRun = operations.getRun;
export const retryZoomExport = operations.retry;
export const updateZoomExportSchedule = operations.updateSchedule;
export const deleteZoomExportSchedule = operations.deleteSchedule;
