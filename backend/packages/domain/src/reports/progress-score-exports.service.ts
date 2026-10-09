import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  PROGRESS_EXPORT_COLUMNS,
  PROGRESS_SCORE_EXPORT_DATASETS,
  SCORE_EXPORT_COLUMNS,
  createProgressScoreExportBodySchema,
  createProgressScoreExportResponseSchema,
  deleteProgressScoreExportScheduleResponseSchema,
  progressScoreExportRunDetailResponseSchema,
  progressScoreExportsResponseSchema,
  retryProgressScoreExportResponseSchema,
  updateProgressScoreExportScheduleBodySchema,
  updateProgressScoreExportScheduleResponseSchema,
  type CreateProgressScoreExportBody,
} from "./progress-score-exports.dto";
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

const DEFINITION_KEY = "progress-score";

type ProgressScoreDataset = (typeof PROGRESS_SCORE_EXPORT_DATASETS)[number];

function datasetLabel(dataset: ProgressScoreDataset): string {
  if (dataset === "scores") return "Scores";
  if (dataset === "attempts") return "Attempts";
  if (dataset === "item_analysis") return "Item analysis";
  return "Progress";
}

function normalizeDataset(value: unknown): ProgressScoreDataset {
  if (
    typeof value === "string" &&
    (PROGRESS_SCORE_EXPORT_DATASETS as readonly string[]).includes(value)
  ) {
    return value as ProgressScoreDataset;
  }
  return "progress";
}

function fileNameFor(dataset: ProgressScoreDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const slug =
    dataset === "scores"
      ? "scores"
      : dataset === "attempts"
        ? "attempts"
        : dataset === "item_analysis"
          ? "item-analysis"
          : "progress";
  return `progress_score_${slug}_${stamp}.${format === "json" ? "json" : format}`;
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  const parts: string[] = [];
  const productType = params["productType"];
  const productId = params["productId"] ?? params["courseId"];
  if (typeof productId === "string" && productId.trim()) {
    parts.push(
      typeof productType === "string" && productType.trim() ? productType.trim() : "Product",
    );
  } else {
    parts.push("All products");
  }
  const assessmentId = params["assessmentId"];
  if (typeof assessmentId === "string" && assessmentId.trim()) {
    parts.push("Assessment scoped");
  }
  const from = formatDateShort(
    typeof params["dateFrom"] === "string" ? params["dateFrom"] : undefined,
  );
  const to = formatDateShort(typeof params["dateTo"] === "string" ? params["dateTo"] : undefined);
  if (from && to) parts.push(`${from} – ${to}`);
  else if (from) parts.push(`From ${from}`);
  else if (to) parts.push(`Until ${to}`);
  else parts.push("All time");
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the progress & score artifact.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Progress & score report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

const view: ExportViewSpec<ProgressScoreDataset> = {
  datasetParams: ["reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: false,
  columns: true,
  defaultScheduleName: "Progress & score export",
  cadenceWording: "comma",
  scheduleDataset: false,
  webhookLabel: "webhook",
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
    runDetail: progressScoreExportRunDetailResponseSchema,
    retry: retryProgressScoreExportResponseSchema,
    updateScheduleBody: updateProgressScoreExportScheduleBodySchema,
    updateSchedule: updateProgressScoreExportScheduleResponseSchema,
    deleteSchedule: deleteProgressScoreExportScheduleResponseSchema,
  },
});

function buildRunParams(body: CreateProgressScoreExportBody): Record<string, unknown> {
  const params: Record<string, unknown> = {
    reportTab: body.dataset,
    columns: body.columns,
  };
  if (body.productType) params["productType"] = body.productType;
  if (body.productId) params["productId"] = body.productId;
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.assessmentId) params["assessmentId"] = body.assessmentId;
  if (body.dateFrom) params["dateFrom"] = body.dateFrom;
  if (body.dateTo) params["dateTo"] = body.dateTo;
  if (body.learnerName?.trim()) params["learnerName"] = body.learnerName.trim();
  if (body.enrolledType?.trim()) params["enrolledType"] = body.enrolledType.trim();
  if (body.status?.trim()) params["status"] = body.status.trim();
  if (body.resultStatus) params["resultStatus"] = body.resultStatus;
  if (body.delivery === "email_me") {
    params["emailDownloadLink"] = true;
    params["deliveryMode"] = "email_me";
  } else if (body.delivery === "recipients") {
    params["deliveryMode"] = "recipients";
    if (body.recipients && body.recipients.length > 0) {
      params["deliveryEmails"] = body.recipients;
    }
  }
  if (body.webhookUrl?.trim()) params["webhookUrl"] = body.webhookUrl.trim();
  return params;
}

export async function getProgressScoreExports(tx: TenantTx, ctx: ServiceCtx) {
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
      expiresAt: run.expiresAt,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      errorTrace: run.errorTrace,
      progressPercent: run.progressPercent,
    }),
  );

  const progressSchedules = schedules.data.items
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

  return progressScoreExportsResponseSchema.parse({
    data: {
      history,
      schedules: progressSchedules,
      progressColumns: PROGRESS_EXPORT_COLUMNS.map((column) => ({ ...column })),
      scoreColumns: SCORE_EXPORT_COLUMNS.map((column) => ({ ...column })),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...PROGRESS_SCORE_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        note: "Exports generate from progress & score datasets. Attempts and item analysis currently use the scores query until dedicated SQL exists. Email and webhook delivery run after the artifact is ready. Ready files expire after the signed download TTL.",
      },
    },
  });
}

export async function createProgressScoreExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateProgressScoreExportBody,
) {
  const body = createProgressScoreExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.delivery === "recipients" && (!body.recipients || body.recipients.length === 0)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Add at least one recipient email for recipient delivery.",
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
    const time = body.time ?? "06:00";
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

  return createProgressScoreExportResponseSchema.parse({
    data: {
      run: mapHistoryItem({
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
      }),
      schedule,
    },
  });
}

export const getProgressScoreExportRun = operations.getRun;
export const retryProgressScoreExport = operations.retry;
export const updateProgressScoreExportSchedule = operations.updateSchedule;
export const deleteProgressScoreExportSchedule = operations.deleteSchedule;
