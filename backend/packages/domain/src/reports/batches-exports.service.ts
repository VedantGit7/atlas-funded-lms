import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  BATCH_EXPORT_DATASETS,
  BATCH_LEARNERS_EXPORT_COLUMNS,
  BATCH_SUMMARY_EXPORT_COLUMNS,
  createBatchExportBodySchema,
  createBatchExportResponseSchema,
  batchExportRunDetailResponseSchema,
  batchesExportsResponseSchema,
  retryBatchExportResponseSchema,
  updateBatchExportScheduleResponseSchema,
  type CreateBatchExportBody,
} from "./batches-exports.dto";
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

const DEFINITION_KEY = "batches";

type BatchExportDataset = (typeof BATCH_EXPORT_DATASETS)[number];

function datasetLabel(dataset: BatchExportDataset): string {
  if (dataset === "batch_summary") return "Batch summary";
  if (dataset === "live_attendance") return "Live attendance";
  if (dataset === "exams") return "Exams";
  if (dataset === "content") return "Content";
  return "Batch learners";
}

function normalizeDataset(value: unknown): BatchExportDataset {
  if (typeof value === "string" && (BATCH_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as BatchExportDataset;
  }
  return "batch_learners";
}

function fileNameFor(dataset: BatchExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const slug =
    dataset === "batch_summary"
      ? "summary"
      : dataset === "live_attendance"
        ? "attendance"
        : dataset === "exams"
          ? "exams"
          : dataset === "content"
            ? "content"
            : "learners";
  return `batch-${slug}-${stamp}.${format === "json" ? "json" : format}`;
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  if (typeof params["filterSummary"] === "string" && params["filterSummary"].trim()) {
    return params["filterSummary"].trim();
  }
  const parts: string[] = [];
  if (params["allActiveBatches"] === true) {
    parts.push("All active batches");
  } else {
    const batchIds = params["batchIds"];
    const batchId = params["batchId"];
    if (Array.isArray(batchIds) && batchIds.length > 0) {
      parts.push(batchIds.length === 1 ? "1 batch" : `${String(batchIds.length)} batches`);
    } else if (typeof batchId === "string" && batchId.trim()) {
      parts.push("1 batch");
    } else {
      parts.push("All batches");
    }
  }
  const from = formatDateShort(
    typeof params["joinedFrom"] === "string" ? params["joinedFrom"] : undefined,
  );
  const to = formatDateShort(
    typeof params["joinedTo"] === "string" ? params["joinedTo"] : undefined,
  );
  if (from && to) parts.push(`joined ${from} - ${to}`);
  else if (from) parts.push(`joined after ${from}`);
  else if (to) parts.push(`joined before ${to}`);
  if (typeof params["status"] === "string" && params["status"].trim()) {
    parts.push(`Status ${params["status"]}`);
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the batch artifact. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Batches report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

const view: ExportViewSpec<BatchExportDataset> = {
  datasetParams: ["reportTab", "dataset"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: true,
  defaultScheduleName: "Batch export",
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
    runDetail: batchExportRunDetailResponseSchema,
    retry: retryBatchExportResponseSchema,
    updateScheduleBody: updateReportExportScheduleBodySchema,
    updateSchedule: updateBatchExportScheduleResponseSchema,
    deleteSchedule: deleteReportExportScheduleResponseSchema,
  },
});

function buildRunParams(body: CreateBatchExportBody): Record<string, unknown> {
  const params: Record<string, unknown> = {
    reportTab: body.dataset,
    dataset: body.dataset,
    columns: body.columns,
    grouping: body.grouping,
    includeSubtotals: body.includeSubtotals,
  };
  if (body.allActiveBatches) {
    params["allActiveBatches"] = true;
  } else if (body.batchIds && body.batchIds.length > 0) {
    params["batchIds"] = body.batchIds;
    if (body.batchIds.length === 1) params["batchId"] = body.batchIds[0];
  }
  if (body.joinedFrom) params["joinedFrom"] = body.joinedFrom;
  if (body.joinedTo) params["joinedTo"] = body.joinedTo;
  if (body.learnerName?.trim()) params["learnerName"] = body.learnerName.trim();
  if (body.status) params["status"] = body.status;
  if (body.filterSummary?.trim()) params["filterSummary"] = body.filterSummary.trim();
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

export async function getBatchesExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
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

  const batchSchedules = schedules.data.items
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

  return batchesExportsResponseSchema.parse({
    data: {
      history,
      schedules: batchSchedules,
      summaryColumns: BATCH_SUMMARY_EXPORT_COLUMNS.map((column) => ({ ...column })),
      learnerColumns: BATCH_LEARNERS_EXPORT_COLUMNS.map((column) => ({ ...column })),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...BATCH_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        note: "Exports generate from the batches dataset. Live attendance, exams, and content currently share the learner membership rows until dedicated SQL lands. Ready files expire after the signed download TTL (typically 7 days).",
      },
    },
  });
}

export async function createBatchExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateBatchExportBody,
) {
  const body = createBatchExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.delivery === "recipients" && (!body.recipients || body.recipients.length === 0)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Add at least one recipient email for recipient delivery.",
    });
  }

  if (
    !body.allActiveBatches &&
    (!body.batchIds || body.batchIds.length === 0) &&
    body.dataset !== "batch_summary"
  ) {
    // Allow all batches when none selected (matches list export behaviour)
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
    const timezone = body.timezone ?? "Asia/Kolkata";
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

  return createBatchExportResponseSchema.parse({
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

export const getBatchExportRun = operations.getRun;
export const retryBatchExport = operations.retry;
export const updateBatchExportSchedule = operations.updateSchedule;
export const deleteBatchExportSchedule = operations.deleteSchedule;
