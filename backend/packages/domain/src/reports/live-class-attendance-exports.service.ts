import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  LCA_EXPORT_COLUMNS,
  LCA_EXPORT_DATASETS,
  createLiveClassAttendanceExportBodySchema,
  createLiveClassAttendanceExportResponseSchema,
  liveClassAttendanceExportRunDetailResponseSchema,
  liveClassAttendanceExportsResponseSchema,
  retryLiveClassAttendanceExportResponseSchema,
  updateLiveClassAttendanceExportScheduleResponseSchema,
  type CreateLiveClassAttendanceExportBody,
} from "./live-class-attendance-exports.dto";
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
import {
  deleteReportExportScheduleResponseSchema,
  updateReportExportScheduleBodySchema,
} from "./report-exports.dto";

const DEFINITION_KEY = "live-class-attendance";

type LcaExportDataset = (typeof LCA_EXPORT_DATASETS)[number];

function datasetLabel(dataset: LcaExportDataset): string {
  if (dataset === "sessions") return "Sessions";
  if (dataset === "learner_summary") return "Learner summary";
  if (dataset === "series_rollup") return "Series rollup";
  return "Attendees";
}

function normalizeDataset(value: unknown): LcaExportDataset {
  if (typeof value === "string" && (LCA_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as LcaExportDataset;
  }
  return "attendees";
}

function fileNameFor(dataset: LcaExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "export"
    : date.toISOString().slice(0, 10).replace(/-/g, "");
  const ext = format === "json" ? "json" : format;
  return `live_attendance_${dataset}_${stamp}.${ext}`;
}

function resolveDateRange(body: CreateLiveClassAttendanceExportBody): {
  scheduledFrom?: string;
  scheduledTo?: string;
} {
  if (body.datePreset === "custom") {
    const range: { scheduledFrom?: string; scheduledTo?: string } = {};
    if (body.scheduledFrom) range.scheduledFrom = body.scheduledFrom;
    if (body.scheduledTo) range.scheduledTo = body.scheduledTo;
    return range;
  }
  const days = body.datePreset === "7d" ? 7 : body.datePreset === "90d" ? 90 : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { scheduledFrom: from.toISOString(), scheduledTo: to.toISOString() };
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  if (typeof params["filterSummary"] === "string" && params["filterSummary"].trim()) {
    return params["filterSummary"].trim();
  }
  const parts: string[] = [];
  const from = formatDateShort(
    typeof params["scheduledFrom"] === "string"
      ? params["scheduledFrom"]
      : typeof params["joinedFrom"] === "string"
        ? params["joinedFrom"]
        : undefined,
  );
  const to = formatDateShort(
    typeof params["scheduledTo"] === "string"
      ? params["scheduledTo"]
      : typeof params["joinedTo"] === "string"
        ? params["joinedTo"]
        : undefined,
  );
  if (from && to) parts.push(`${from} – ${to}`);
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
  if (params["registrationMode"] === "attendees_only") {
    parts.push("Attendees only");
  } else if (params["registrationMode"] === "include_never_joined") {
    parts.push("Includes never joined");
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export failed while assembling attendance rows. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Live class attendance report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

const view: ExportViewSpec<LcaExportDataset> = {
  datasetParams: ["dataset", "reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: false,
  defaultScheduleName: "Attendance export",
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
    runDetail: liveClassAttendanceExportRunDetailResponseSchema,
    retry: retryLiveClassAttendanceExportResponseSchema,
    updateScheduleBody: updateReportExportScheduleBodySchema,
    updateSchedule: updateLiveClassAttendanceExportScheduleResponseSchema,
    deleteSchedule: deleteReportExportScheduleResponseSchema,
  },
});

function defaultColumnsForDataset(dataset: LcaExportDataset): string[] {
  if (dataset === "sessions") {
    return ["session_title", "course_title", "batch_name", "status", "duration_seconds"];
  }
  if (dataset === "learner_summary") {
    return ["learner_name", "email", "status", "duration_seconds", "coverage_pct", "course_title"];
  }
  if (dataset === "series_rollup") {
    return ["course_title", "batch_name", "status", "duration_seconds", "coverage_pct"];
  }
  return [
    "learner_name",
    "email",
    "status",
    "joined_at",
    "left_at",
    "duration_seconds",
    "coverage_pct",
    "session_title",
    "course_title",
  ];
}

function buildRunParams(body: CreateLiveClassAttendanceExportBody): Record<string, unknown> {
  const range = resolveDateRange(body);
  const columns =
    body.columns && body.columns.length > 0 ? body.columns : defaultColumnsForDataset(body.dataset);

  const params: Record<string, unknown> = {
    dataset: body.dataset,
    reportTab: body.dataset,
    scopeMode: body.scopeMode,
    datePreset: body.datePreset,
    registrationMode: body.registrationMode,
    columns,
    selectedColumns: columns,
  };

  if (range.scheduledFrom) {
    params["scheduledFrom"] = range.scheduledFrom;
    params["joinedFrom"] = range.scheduledFrom;
  }
  if (range.scheduledTo) {
    params["scheduledTo"] = range.scheduledTo;
    params["joinedTo"] = range.scheduledTo;
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
  includeNeverJoinedRows: number | null;
  attendeesOnlyRows: number | null;
}> {
  try {
    const rows = await tx.$queryRaw<Array<{ total: number; attended: number }>>`
      select
        count(*)::int as total,
        count(*) filter (where la.status = 'attended')::int as attended
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
    `;
    const row = rows[0];
    return {
      includeNeverJoinedRows: row?.total ?? 0,
      attendeesOnlyRows: row?.attended ?? 0,
    };
  } catch {
    return { includeNeverJoinedRows: null, attendeesOnlyRows: null };
  }
}

export async function getLiveClassAttendanceExports(tx: TenantTx, ctx: ServiceCtx) {
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

  const lcaSchedules = schedules.data.items
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

  return liveClassAttendanceExportsResponseSchema.parse({
    data: {
      history,
      schedules: lcaSchedules,
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...LCA_EXPORT_DATASETS],
        columns: [...LCA_EXPORT_COLUMNS],
        canSchedule: true,
        canEmailDelivery: true,
        note: "Ready files are deleted after 7 days. Choose a dataset grain, then narrow scope before exporting.",
      },
      estimates,
    },
  });
}

export async function createLiveClassAttendanceExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateLiveClassAttendanceExportBody,
) {
  const body = createLiveClassAttendanceExportBodySchema.parse(input);
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
    const cadence = body.cadence ?? "weekly";
    const time = body.time ?? "07:00";
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

  return createLiveClassAttendanceExportResponseSchema.parse({
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

export const getLiveClassAttendanceExportRun = operations.getRun;
export const retryLiveClassAttendanceExport = operations.retry;
export const updateLiveClassAttendanceExportSchedule = operations.updateSchedule;
export const deleteLiveClassAttendanceExportSchedule = operations.deleteSchedule;

export function runLiveClassAttendanceExportScheduleNow(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
) {
  return operations.runScheduleNow(
    tx,
    ctx,
    scheduleId,
    createLiveClassAttendanceExportResponseSchema,
  );
}
