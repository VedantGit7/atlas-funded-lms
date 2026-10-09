import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  SLI_EXPORT_COLUMNS,
  SLI_EXPORT_DATASETS,
  createSuperLiveInsightsExportBodySchema,
  createSuperLiveInsightsExportResponseSchema,
  deleteSuperLiveInsightsExportScheduleResponseSchema,
  superLiveInsightsExportRunDetailResponseSchema,
  superLiveInsightsExportsResponseSchema,
  retrySuperLiveInsightsExportResponseSchema,
  updateSuperLiveInsightsExportScheduleBodySchema,
  updateSuperLiveInsightsExportScheduleResponseSchema,
  type CreateSuperLiveInsightsExportBody,
} from "./super-live-insights-exports.dto";
import {
  createReportRun,
  createReportSchedule,
  ensureTenantReportDefinitions,
  listReportRuns,
  listReportSchedules,
} from "./reports.service";
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

const DEFINITION_KEY = "super-live-insights";

type SliExportDataset = (typeof SLI_EXPORT_DATASETS)[number];

function datasetLabel(dataset: SliExportDataset): string {
  if (dataset === "trend_series") return "Trend series";
  if (dataset === "series_rollup") return "Series rollup";
  if (dataset === "outlier_findings") return "Outlier findings";
  return "Session metrics";
}

function normalizeDataset(value: unknown): SliExportDataset {
  if (typeof value === "string" && (SLI_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as SliExportDataset;
  }
  // Legacy one-shot exports had no dataset field.
  return "session_metrics";
}

function fileNameFor(dataset: SliExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "export"
    : date.toISOString().slice(0, 10).replace(/-/g, "");
  const ext = format === "json" ? "json" : format;
  return `live-insights-${dataset.replace(/_/g, "-")}-${stamp}.${ext}`;
}

function resolveDateRange(body: CreateSuperLiveInsightsExportBody): {
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
      : typeof params["scheduledFrom"] === "string"
        ? params["scheduledFrom"]
        : undefined,
  );
  const to = formatDateShort(
    typeof params["startedTo"] === "string"
      ? params["startedTo"]
      : typeof params["scheduledTo"] === "string"
        ? params["scheduledTo"]
        : undefined,
  );
  if (from && to) parts.push(`${from} - ${to}`);
  else if (from) parts.push(`From ${from}`);
  else if (to) parts.push(`Until ${to}`);
  else parts.push("All time");

  if (typeof params["courseId"] === "string" && params["courseId"].trim()) {
    parts.push("Course scoped");
  }
  if (typeof params["batchId"] === "string" && params["batchId"].trim()) {
    parts.push("Batch scoped");
  }
  if (Array.isArray(params["sessionIds"]) && params["sessionIds"].length > 0) {
    parts.push(`${String(params["sessionIds"].length)} session(s)`);
  }
  if (params["includeBenchmarks"] === true) {
    parts.push("With benchmarks");
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export failed while assembling session insight rows. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested dataset exceeds the row limit for this format. Try splitting the date range or using CSV.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Super Live Insights report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

const view: ExportViewSpec<SliExportDataset> = {
  datasetParams: ["dataset", "reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: false,
  defaultScheduleName: "Insights export",
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
    runDetail: superLiveInsightsExportRunDetailResponseSchema,
    retry: retrySuperLiveInsightsExportResponseSchema,
    updateScheduleBody: updateSuperLiveInsightsExportScheduleBodySchema,
    updateSchedule: updateSuperLiveInsightsExportScheduleResponseSchema,
    deleteSchedule: deleteSuperLiveInsightsExportScheduleResponseSchema,
  },
});

function defaultColumnsForDataset(dataset: SliExportDataset, includeBenchmarks: boolean): string[] {
  if (dataset === "trend_series") {
    return ["period_start", "session_count", "attended_count", "total_count", "attendance_rate"];
  }
  if (dataset === "series_rollup") {
    return [
      "series_title",
      "session_count",
      "attended_count",
      "registered_count",
      "absent_count",
      "total_count",
      "attendance_rate",
    ];
  }
  if (dataset === "outlier_findings") {
    return [
      "category",
      "severity",
      "title",
      "session_title",
      "course_title",
      "batch_name",
      "scheduled_at",
      "attendance_rate",
      "course_avg_rate",
    ];
  }
  const columns = [
    "title",
    "status",
    "course_title",
    "batch_name",
    "scheduled_at",
    "started_at",
    "ended_at",
    "duration_seconds",
    "attended_count",
    "registered_count",
    "absent_count",
    "total_count",
    "avg_duration_seconds",
    "attendance_rate",
  ];
  if (includeBenchmarks) {
    columns.push("tenant_avg_rate", "course_avg_rate");
  }
  return columns;
}

function buildRunParams(body: CreateSuperLiveInsightsExportBody): Record<string, unknown> {
  const range = resolveDateRange(body);
  const columns =
    body.columns && body.columns.length > 0
      ? body.columns
      : defaultColumnsForDataset(body.dataset, body.includeBenchmarks);

  const params: Record<string, unknown> = {
    dataset: body.dataset,
    reportTab: body.dataset,
    scopeMode: body.scopeMode,
    datePreset: body.datePreset,
    includeBenchmarks: body.includeBenchmarks,
    granularity: body.granularity,
    seriesKind: body.seriesKind,
    columns,
    selectedColumns: columns,
  };

  if (range.startedFrom) {
    params["startedFrom"] = range.startedFrom;
    params["scheduledFrom"] = range.startedFrom;
  }
  if (range.startedTo) {
    params["startedTo"] = range.startedTo;
    params["scheduledTo"] = range.startedTo;
  }
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.batchId) params["batchId"] = body.batchId;
  if (body.sessionIds && body.sessionIds.length > 0) {
    params["sessionIds"] = body.sessionIds;
  }
  if (body.filterSummary?.trim()) params["filterSummary"] = body.filterSummary.trim();

  if (body.delivery === "email_me" || body.delivery === "send_recipients") {
    params["emailDownloadLink"] = true;
    params["deliveryMode"] = body.delivery;
  } else {
    params["deliveryMode"] = "download";
  }
  if (body.recipients && body.recipients.length > 0) {
    params["recipients"] = body.recipients;
  }
  if (body.webhookUrl) params["webhookUrl"] = body.webhookUrl;

  return params;
}

async function estimateRowCounts(tx: TenantTx): Promise<{
  sessionMetricsRows: number | null;
  outlierFindingsRows: number | null;
}> {
  try {
    const rows = await tx.$queryRaw<Array<{ sessions: number }>>`
      select count(*)::int as sessions
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
    `;
    return {
      sessionMetricsRows: rows[0]?.sessions ?? 0,
      outlierFindingsRows: null,
    };
  } catch {
    return { sessionMetricsRows: null, outlierFindingsRows: null };
  }
}

export async function getSuperLiveInsightsExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules, estimates] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
    estimateRowCounts(tx),
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

  const sliSchedules = schedules.data.items
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

  return superLiveInsightsExportsResponseSchema.parse({
    data: {
      history,
      schedules: sliSchedules,
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...SLI_EXPORT_DATASETS],
        columns: [...SLI_EXPORT_COLUMNS],
        canSchedule: true,
        canEmailDelivery: true,
        note: "Ready files are deleted after 7 days. This export contains aggregate counts only - learner names live in Live Class Attendance.",
      },
      estimates,
    },
  });
}

export async function createSuperLiveInsightsExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateSuperLiveInsightsExportBody,
) {
  const body = createSuperLiveInsightsExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.delivery === "send_recipients" && (!body.recipients || body.recipients.length === 0)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Add at least one recipient email when delivery is Send to recipients.",
    });
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
    const cadence = body.cadence ?? "monthly";
    const time = body.time ?? "07:00";
    const timezone = body.timezone ?? "Asia/Kolkata";
    const scheduleResult = await createReportSchedule(tx, ctx, {
      definitionKey: DEFINITION_KEY,
      name: body.scheduleName?.trim() || `Monthly ${datasetLabel(body.dataset)} export`,
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
      params: scheduleResult.data.params,
      delivery: scheduleResult.data.delivery,
    });
  }

  return createSuperLiveInsightsExportResponseSchema.parse({
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

export const getSuperLiveInsightsExportRun = operations.getRun;
export const retrySuperLiveInsightsExport = operations.retry;
export const updateSuperLiveInsightsExportSchedule = operations.updateSchedule;
export const deleteSuperLiveInsightsExportSchedule = operations.deleteSchedule;

export function runSuperLiveInsightsExportScheduleNow(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
) {
  return operations.runScheduleNow(
    tx,
    ctx,
    scheduleId,
    createSuperLiveInsightsExportResponseSchema,
  );
}
