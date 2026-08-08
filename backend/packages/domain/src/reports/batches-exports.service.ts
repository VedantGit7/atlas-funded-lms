import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  BATCH_EXPORT_DATASETS,
  BATCH_LEARNERS_EXPORT_COLUMNS,
  BATCH_SUMMARY_EXPORT_COLUMNS,
  createBatchExportBodySchema,
  createBatchExportResponseSchema,
  deleteBatchExportScheduleResponseSchema,
  batchExportRunDetailResponseSchema,
  batchesExportsResponseSchema,
  retryBatchExportResponseSchema,
  updateBatchExportScheduleBodySchema,
  updateBatchExportScheduleResponseSchema,
  type CreateBatchExportBody,
} from "./batches-exports.dto";
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

const DEFINITION_KEY = "batches";

type BatchExportDataset = (typeof BATCH_EXPORT_DATASETS)[number];

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

function columnsFromParams(params: Record<string, unknown>): string[] {
  const columns = params["columns"];
  if (!Array.isArray(columns)) return [];
  return columns.filter((item): item is string => typeof item === "string");
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
  const dataset = normalizeDataset(run.params["reportTab"] ?? run.params["dataset"]);
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
    columns: columnsFromParams(run.params),
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
  const webhookUrl = typeof delivery["webhookUrl"] === "string" ? delivery["webhookUrl"] : null;
  const dataset = normalizeDataset(schedule.params["reportTab"] ?? schedule.params["dataset"]);
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || "Batch export",
    datasetLabel: datasetLabel(dataset),
    cadenceLabel: cadenceLabel(schedule.cronExpression, schedule.timezone),
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    formats: schedule.formats,
    isActive: schedule.isActive,
    nextRunAt: schedule.nextRunAt,
    nextRunLabel: nextRunLabel(schedule.nextRunAt),
    recipients,
    webhookLabel: webhookUrl ? "webhook" : null,
    delivery: schedule.delivery,
  };
}

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

export async function getBatchExportRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return batchExportRunDetailResponseSchema.parse({
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

export async function retryBatchExport(tx: TenantTx, ctx: ServiceCtx, runId: string) {
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

  return retryBatchExportResponseSchema.parse({
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

export async function updateBatchExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean | undefined; name?: string | undefined },
) {
  const body = updateBatchExportScheduleBodySchema.parse(input);
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
  return updateBatchExportScheduleResponseSchema.parse({
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

export async function deleteBatchExportSchedule(tx: TenantTx, ctx: ServiceCtx, scheduleId: string) {
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
  return deleteBatchExportScheduleResponseSchema.parse(deleted);
}
