import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import type { ServiceCtx } from "../shared/domain.types";
import { createExportJob } from "../data-rights/data-rights.service";
import { dataRightsRepository } from "../data-rights/data-rights.repository";
import type { JobStatus } from "./reports.contract";
import {
  cancelExportRunResponseSchema,
  deleteExportRunFileResponseSchema,
  EXPORT_PIPELINE_STAGES,
  exportRunDetailResponseSchema,
  retryExportRunResponseSchema,
  type ExportPipelineStageKey,
  type ExportRunActionBody,
  type ExportRunDetailQuery,
} from "./export-run-detail.dto";
import { reportRunNotFound } from "./reports.errors";
import { createReportRun } from "./reports.service";
import { reportsRepository } from "./reports.repository";

const PII_DEFINITION_KEYS = new Set([
  "enrollments",
  "progress-score",
  "payments",
  "active-devices",
  "custom-field",
  "sales-marketing",
  "certificates",
  "at-risk-roster",
  "live-class-attendance",
  "zoom-insights",
  "super-live-insights",
]);

const STAGE_LABELS: Record<ExportPipelineStageKey, string> = {
  queued: "Queued",
  started: "Started",
  query: "Query",
  serialize: "Serialize",
  upload: "Upload",
  delivered: "Delivered",
};

type SourceType = "report_run" | "export_job";
type PipelineState = "complete" | "current" | "failed" | "pending" | "skipped";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function mapErrorCode(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const code = (errorJson as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function mapErrorMessage(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const message = (errorJson as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : null;
}

function mapErrorTrace(errorJson: unknown): string[] | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const trace = (errorJson as { trace?: unknown }).trace;
  if (!Array.isArray(trace)) return null;
  const lines = trace.filter((item): item is string => typeof item === "string");
  return lines.length > 0 ? lines : null;
}

function mapProgressStage(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const stage = (errorJson as { stage?: unknown }).stage;
  return typeof stage === "string" ? stage : null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateSizeLabel(rowCount: number | null, format: string | null): string | null {
  if (rowCount == null || rowCount < 0) return null;
  const perRow = format === "xlsx" ? 120 : format === "json" || format === "jsonl" ? 180 : 64;
  return `~${formatBytes(Math.max(rowCount, 1) * perRow)}`;
}

function titleCaseKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateChip(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function humanizeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : null))
      .filter((item): item is string => item != null)
      .join(", ");
  }
  return JSON.stringify(value);
}

function buildFilterChips(params: Record<string, unknown>): string[] {
  const chips: string[] = [];
  const skip = new Set([
    "columns",
    "sort",
    "sortBy",
    "sortDir",
    "orderBy",
    "rowLimit",
    "limit",
    "format",
    "delivery",
    "filterSummary",
  ]);

  if (typeof params["filterSummary"] === "string" && params["filterSummary"].trim()) {
    chips.push(params["filterSummary"].trim());
  }

  for (const [key, value] of Object.entries(params)) {
    if (skip.has(key) || value == null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;

    if (key === "status" || key === "statuses") {
      chips.push(`Status is ${humanizeValue(value)}`);
      continue;
    }
    if (key === "gateway" || key === "gateways") {
      chips.push(`Gateway is ${humanizeValue(value)}`);
      continue;
    }
    if (
      (key.endsWith("From") ||
        key.endsWith("To") ||
        key.includes("date") ||
        key.includes("Date")) &&
      typeof value === "string"
    ) {
      const label = titleCaseKey(key.replace(/(From|To)$/, ""));
      const suffix = key.endsWith("From") ? "from" : key.endsWith("To") ? "to" : "";
      chips.push(`${label}${suffix ? ` ${suffix}` : ""} ${formatDateChip(value)}`);
      continue;
    }
    if (typeof value === "boolean") {
      chips.push(`${titleCaseKey(key)}: ${value ? "yes" : "no"}`);
      continue;
    }
    chips.push(`${titleCaseKey(key)} is ${humanizeValue(value)}`);
  }

  return chips.slice(0, 12);
}

function extractColumns(params: Record<string, unknown>): string[] {
  const raw = params["columns"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function extractSortLabel(params: Record<string, unknown>): string | null {
  if (typeof params["sort"] === "string" && params["sort"].trim()) {
    return params["sort"].trim();
  }
  const sortBy =
    typeof params["sortBy"] === "string"
      ? params["sortBy"]
      : typeof params["orderBy"] === "string"
        ? params["orderBy"]
        : null;
  const sortDir =
    typeof params["sortDir"] === "string"
      ? params["sortDir"]
      : typeof params["order"] === "string"
        ? params["order"]
        : "asc";
  if (!sortBy) return null;
  return `${titleCaseKey(sortBy)} ${sortDir}`;
}

function extractRowLimitLabel(params: Record<string, unknown>): string | null {
  const limit = params["rowLimit"] ?? params["limit"];
  if (typeof limit === "number" && Number.isFinite(limit)) {
    return String(Math.trunc(limit));
  }
  if (typeof limit === "string" && limit.trim()) {
    return limit.trim();
  }
  return null;
}

function extractDelivery(params: Record<string, unknown>): {
  kind: "download_only" | "email" | "webhook" | "storage";
  label: string;
  recipients: string[];
  status: string | null;
  deliveredAt: string | null;
  error: string | null;
} {
  const delivery = asRecord(params["delivery"]);
  const kindRaw = typeof delivery["kind"] === "string" ? delivery["kind"] : null;
  const destinationId =
    typeof delivery["destinationId"] === "string"
      ? delivery["destinationId"]
      : typeof params["destinationId"] === "string"
        ? params["destinationId"]
        : null;
  const recipients = Array.isArray(delivery["recipients"])
    ? delivery["recipients"].filter((item): item is string => typeof item === "string")
    : typeof delivery["email"] === "string"
      ? [delivery["email"]]
      : [];

  if (destinationId) {
    const destKind =
      kindRaw === "email" || kindRaw === "webhook" || kindRaw === "storage" ? kindRaw : "storage";
    return {
      kind: destKind,
      label: "Destination",
      recipients: [destinationId],
      status: typeof delivery["status"] === "string" ? delivery["status"] : null,
      deliveredAt: typeof delivery["deliveredAt"] === "string" ? delivery["deliveredAt"] : null,
      error: typeof delivery["error"] === "string" ? delivery["error"] : null,
    };
  }

  if (kindRaw === "email" || recipients.length > 0) {
    return {
      kind: "email",
      label: "Email",
      recipients,
      status: typeof delivery["status"] === "string" ? delivery["status"] : null,
      deliveredAt: typeof delivery["deliveredAt"] === "string" ? delivery["deliveredAt"] : null,
      error: typeof delivery["error"] === "string" ? delivery["error"] : null,
    };
  }
  if (kindRaw === "webhook") {
    return {
      kind: "webhook",
      label: "Webhook",
      recipients: typeof delivery["url"] === "string" ? [delivery["url"]] : [],
      status: typeof delivery["status"] === "string" ? delivery["status"] : null,
      deliveredAt: typeof delivery["deliveredAt"] === "string" ? delivery["deliveredAt"] : null,
      error: typeof delivery["error"] === "string" ? delivery["error"] : null,
    };
  }
  if (kindRaw === "storage") {
    return {
      kind: "storage",
      label: "Storage bucket",
      recipients: typeof delivery["bucket"] === "string" ? [delivery["bucket"]] : [],
      status: typeof delivery["status"] === "string" ? delivery["status"] : null,
      deliveredAt: typeof delivery["deliveredAt"] === "string" ? delivery["deliveredAt"] : null,
      error: typeof delivery["error"] === "string" ? delivery["error"] : null,
    };
  }
  return {
    kind: "download_only",
    label: "Download only",
    recipients: [],
    status: null,
    deliveredAt: null,
    error: null,
  };
}

function workerStageToPipeline(stage: string | null): ExportPipelineStageKey | null {
  if (!stage) return null;
  if (stage === "querying" || stage === "dataset") return "query";
  if (stage === "rendering") return "serialize";
  if (stage === "uploading") return "upload";
  return null;
}

function progressToPipeline(progress: number | null): ExportPipelineStageKey {
  if (progress == null || progress < 10) return "started";
  if (progress < 70) return "query";
  if (progress < 88) return "serialize";
  if (progress < 100) return "upload";
  return "delivered";
}

function buildPipeline(args: {
  status: JobStatus;
  progressPercent: number | null;
  progressStage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}): {
  pipeline: Array<{
    key: ExportPipelineStageKey;
    label: string;
    state: PipelineState;
    at: string | null;
  }>;
  failedStage: ExportPipelineStageKey | null;
} {
  const stages = [...EXPORT_PIPELINE_STAGES];
  const current =
    args.status === "QUEUED"
      ? "queued"
      : args.status === "SUCCEEDED"
        ? "delivered"
        : args.status === "CANCELLED"
          ? "started"
          : (workerStageToPipeline(args.progressStage) ?? progressToPipeline(args.progressPercent));

  const failedStage =
    args.status === "FAILED"
      ? (workerStageToPipeline(args.progressStage) ?? progressToPipeline(args.progressPercent))
      : null;

  const currentIndex = stages.indexOf(current);
  const failedIndex = failedStage ? stages.indexOf(failedStage) : -1;

  const pipeline = stages.map((key, index) => {
    let state: PipelineState;
    if (args.status === "SUCCEEDED") {
      state = "complete";
    } else if (args.status === "FAILED" && failedIndex >= 0) {
      if (index < failedIndex) state = "complete";
      else if (index === failedIndex) state = "failed";
      else state = "pending";
    } else if (args.status === "CANCELLED") {
      if (index === 0) state = "complete";
      else if (index === 1) state = "failed";
      else state = "pending";
    } else if (args.status === "QUEUED") {
      state = index === 0 ? "current" : "pending";
    } else if (index < currentIndex) {
      state = "complete";
    } else if (index === currentIndex) {
      state = "current";
    } else {
      state = "pending";
    }

    let at: string | null = null;
    if (key === "queued") at = args.createdAt;
    if (key === "started") at = args.startedAt;
    if (key === "delivered" && args.status === "SUCCEEDED") at = args.completedAt;
    if (state === "failed" && args.completedAt) at = args.completedAt;

    return {
      key,
      label: STAGE_LABELS[key],
      state,
      at,
    };
  });

  return { pipeline, failedStage };
}

function failureHint(errorCode: string | null, errorMessage: string | null): string | null {
  const haystack = `${errorCode ?? ""} ${errorMessage ?? ""}`.toLowerCase();
  if (haystack.includes("timeout") || haystack.includes("timed out")) {
    return "The query exceeded the time limit. Narrow the date range or reduce the column count.";
  }
  if (haystack.includes("row cap") || haystack.includes("too many rows")) {
    return "This export exceeded the row cap. Apply tighter filters or export in smaller windows.";
  }
  if (haystack.includes("permission") || haystack.includes("denied")) {
    return "The runner could not access required data. Check report permissions and try again.";
  }
  if (haystack.includes("upload") || haystack.includes("storage")) {
    return "The file could not be stored. Retry the run; if it keeps failing, contact support.";
  }
  return null;
}

function buildFileName(args: {
  definitionKey: string | null;
  definitionTitle: string | null;
  format: string | null;
  createdAt: string;
}): string {
  const date = new Date(args.createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const base =
    (args.definitionKey ?? args.definitionTitle ?? "export")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "export";
  const ext =
    args.format === "xlsx"
      ? "xlsx"
      : args.format === "pdf"
        ? "pdf"
        : args.format === "json" || args.format === "jsonl"
          ? "json"
          : "csv";
  return `${base}-${stamp}.${ext}`;
}

function durationSeconds(
  startedAt: string | null,
  completedAt: string | null,
  createdAt: string,
): number | null {
  const start = startedAt ? new Date(startedAt) : new Date(createdAt);
  const end = completedAt ? new Date(completedAt) : null;
  if (!end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

async function resolveSignedDownloadForKey(
  ctx: ServiceCtx,
  objectKey: string | null,
  status: JobStatus,
): Promise<{ url: string; expiresAt: string } | null> {
  if (status !== "SUCCEEDED" || !objectKey) return null;

  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  assertTenantKeyPrefix({ tenantId: ctx.tenantId, key: objectKey });

  const signed = await provider.createSignedDownloadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
    expiresInSeconds: env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
  });

  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

async function deleteStorageObject(ctx: ServiceCtx, objectKey: string): Promise<void> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  assertTenantKeyPrefix({ tenantId: ctx.tenantId, key: objectKey });
  await provider.deleteObject({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
  });
}

function invalidExportAction(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

async function loadReportRunDetail(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const run = await reportsRepository.findReportRunById(tx, runId);
  if (!run || run.tenant_id !== ctx.tenantId) {
    return null;
  }

  const params = asRecord(run.params_json);
  const progressStage =
    run.status === "RUNNING" || run.status === "FAILED" ? mapProgressStage(run.error_json) : null;
  const errorCode = run.status === "FAILED" ? mapErrorCode(run.error_json) : null;
  const errorMessage = run.status === "FAILED" ? mapErrorMessage(run.error_json) : null;
  const errorTrace = run.status === "FAILED" ? mapErrorTrace(run.error_json) : null;
  const columns = extractColumns(params);
  const delivery = extractDelivery(params);
  const { pipeline, failedStage } = buildPipeline({
    status: run.status,
    progressPercent: run.progress_percent,
    progressStage,
    createdAt: run.created_at.toISOString(),
    startedAt: run.started_at?.toISOString() ?? null,
    completedAt: run.completed_at?.toISOString() ?? null,
  });
  const requester = await reportsRepository.findRequesterProfile(
    tx,
    run.requested_by_membership_id,
  );
  const download = await resolveSignedDownloadForKey(ctx, run.r2_object_key, run.status);
  const hasFile = Boolean(run.r2_object_key);
  const format = run.format;

  return {
    sourceType: "report_run" as const,
    id: run.id,
    fileName: buildFileName({
      definitionKey: run.definition_key,
      definitionTitle: run.definition_title,
      format,
      createdAt: run.created_at.toISOString(),
    }),
    definitionKey: run.definition_key,
    definitionTitle: run.definition_title,
    status: run.status,
    format,
    params,
    filterChips: buildFilterChips(params),
    columnChips: columns.slice(0, 8),
    columnsTotal: columns.length,
    sortLabel: extractSortLabel(params),
    rowLimitLabel: extractRowLimitLabel(params),
    delivery,
    rowCount: run.row_count,
    progressPercent: run.progress_percent,
    estimatedSizeLabel: estimateSizeLabel(run.row_count, format),
    containsPersonalData: PII_DEFINITION_KEYS.has(run.definition_key),
    requestedByName: requester.name,
    requestedByEmail: requester.email,
    createdAt: run.created_at.toISOString(),
    startedAt: run.started_at?.toISOString() ?? null,
    completedAt: run.completed_at?.toISOString() ?? null,
    expiresAt: run.expires_at?.toISOString() ?? null,
    updatedAt: run.updated_at.toISOString(),
    durationSeconds: durationSeconds(
      run.started_at?.toISOString() ?? null,
      run.completed_at?.toISOString() ?? null,
      run.created_at.toISOString(),
    ),
    errorCode,
    errorMessage,
    errorTrace,
    failedStage,
    failureHint: failureHint(errorCode, errorMessage),
    pipeline,
    hasFile,
    canDownload: run.status === "SUCCEEDED" && hasFile,
    canDeleteFile: hasFile,
    canCancel: run.status === "QUEUED" || run.status === "RUNNING",
    canRetry: run.status === "FAILED" || run.status === "CANCELLED" || run.status === "SUCCEEDED",
    download,
    accessLog: [],
    accessLogAvailable: false,
  };
}

async function loadExportJobDetail(tx: TenantTx, ctx: ServiceCtx, jobId: string) {
  const job = await dataRightsRepository.findExportJobById(tx, jobId);
  if (!job || job.tenant_id !== ctx.tenantId) {
    return null;
  }

  const params = asRecord(job.scope_json);
  const columns = extractColumns(params);
  const delivery = extractDelivery(params);
  const errorCode = job.status === "FAILED" ? mapErrorCode(job.error_json) : null;
  const errorMessage = job.status === "FAILED" ? mapErrorMessage(job.error_json) : null;
  const errorTrace = job.status === "FAILED" ? mapErrorTrace(job.error_json) : null;
  const completedAt =
    job.status === "SUCCEEDED" || job.status === "FAILED" ? job.updated_at.toISOString() : null;
  const { pipeline, failedStage } = buildPipeline({
    status: job.status,
    progressPercent: job.status === "RUNNING" ? 50 : job.status === "SUCCEEDED" ? 100 : null,
    progressStage: null,
    createdAt: job.created_at.toISOString(),
    startedAt: job.status === "QUEUED" ? null : job.updated_at.toISOString(),
    completedAt,
  });
  const requester = await reportsRepository.findRequesterProfile(
    tx,
    job.requested_by_membership_id,
  );
  const download = await resolveSignedDownloadForKey(ctx, job.r2_object_key, job.status);
  const hasFile = Boolean(job.r2_object_key);

  return {
    sourceType: "export_job" as const,
    id: job.id,
    fileName: buildFileName({
      definitionKey: "data-rights",
      definitionTitle: "Data rights export",
      format: "json",
      createdAt: job.created_at.toISOString(),
    }),
    definitionKey: null,
    definitionTitle: "Data rights export",
    status: job.status,
    format: "json",
    params,
    filterChips: buildFilterChips(params),
    columnChips: columns.slice(0, 8),
    columnsTotal: columns.length,
    sortLabel: extractSortLabel(params),
    rowLimitLabel: extractRowLimitLabel(params),
    delivery,
    rowCount: null,
    progressPercent: job.status === "RUNNING" ? 50 : job.status === "SUCCEEDED" ? 100 : null,
    estimatedSizeLabel: null,
    containsPersonalData: true,
    requestedByName: requester.name,
    requestedByEmail: requester.email,
    createdAt: job.created_at.toISOString(),
    startedAt: job.status === "QUEUED" ? null : job.updated_at.toISOString(),
    completedAt,
    expiresAt: job.expires_at?.toISOString() ?? null,
    updatedAt: job.updated_at.toISOString(),
    durationSeconds: durationSeconds(
      job.status === "QUEUED" ? null : job.updated_at.toISOString(),
      completedAt,
      job.created_at.toISOString(),
    ),
    errorCode,
    errorMessage,
    errorTrace,
    failedStage,
    failureHint: failureHint(errorCode, errorMessage),
    pipeline,
    hasFile,
    canDownload: job.status === "SUCCEEDED" && hasFile,
    canDeleteFile: hasFile,
    canCancel: job.status === "QUEUED" || job.status === "RUNNING",
    canRetry: job.status === "FAILED" || job.status === "CANCELLED" || job.status === "SUCCEEDED",
    download,
    accessLog: [],
    accessLogAvailable: false,
  };
}

async function resolveSource(tx: TenantTx, ctx: ServiceCtx, runId: string, preferred?: SourceType) {
  if (preferred === "report_run") {
    const detail = await loadReportRunDetail(tx, ctx, runId);
    if (detail) return detail;
    const fallback = await loadExportJobDetail(tx, ctx, runId);
    if (fallback) return fallback;
    throw reportRunNotFound();
  }
  if (preferred === "export_job") {
    const detail = await loadExportJobDetail(tx, ctx, runId);
    if (detail) return detail;
    const fallback = await loadReportRunDetail(tx, ctx, runId);
    if (fallback) return fallback;
    throw reportRunNotFound();
  }

  const reportRun = await loadReportRunDetail(tx, ctx, runId);
  if (reportRun) return reportRun;
  const exportJob = await loadExportJobDetail(tx, ctx, runId);
  if (exportJob) return exportJob;
  throw reportRunNotFound();
}

export async function getExportRunDetail(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
  query: ExportRunDetailQuery = {},
) {
  const detail = await resolveSource(tx, ctx, runId, query.sourceType);
  return exportRunDetailResponseSchema.parse({ data: detail });
}

export async function deleteExportRunFile(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
  body: ExportRunActionBody = {},
) {
  const detail = await resolveSource(tx, ctx, runId, body.sourceType);
  if (!detail.canDeleteFile) {
    throw invalidExportAction("This export has no file to delete.");
  }

  if (detail.sourceType === "report_run") {
    const run = await reportsRepository.findReportRunById(tx, runId);
    if (!run?.r2_object_key) {
      throw invalidExportAction("This export has no file to delete.");
    }
    try {
      await deleteStorageObject(ctx, run.r2_object_key);
    } catch {
      // Keep ledger consistent if the object is already gone.
    }
    await reportsRepository.clearReportRunFile(tx, runId);
  } else {
    const job = await dataRightsRepository.findExportJobById(tx, runId);
    if (!job?.r2_object_key) {
      throw invalidExportAction("This export has no file to delete.");
    }
    try {
      await deleteStorageObject(ctx, job.r2_object_key);
    } catch {
      // Keep ledger consistent if the object is already gone.
    }
    await dataRightsRepository.clearExportJobFile(tx, runId);
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "report.export.file_deleted",
      target: { type: detail.sourceType, id: runId },
      before: { hasFile: true },
      after: { hasFile: false },
      reason: null,
      metadata: { fileName: detail.fileName },
    },
  );

  return deleteExportRunFileResponseSchema.parse({
    data: {
      id: runId,
      sourceType: detail.sourceType,
      deleted: true,
      hasFile: false,
    },
  });
}

export async function cancelExportRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
  body: ExportRunActionBody = {},
) {
  const detail = await resolveSource(tx, ctx, runId, body.sourceType);
  if (!detail.canCancel) {
    throw invalidExportAction("Only queued or running exports can be cancelled.");
  }

  if (detail.sourceType === "report_run") {
    const cancelled = await reportsRepository.cancelReportRun(tx, runId);
    if (!cancelled) {
      throw invalidExportAction("Only queued or running exports can be cancelled.");
    }
  } else {
    const cancelled = await dataRightsRepository.cancelExportJob(tx, runId);
    if (!cancelled) {
      throw invalidExportAction("Only queued or running exports can be cancelled.");
    }
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "report.export.cancelled",
      target: { type: detail.sourceType, id: runId },
      before: { status: detail.status },
      after: { status: "CANCELLED" },
      reason: null,
      metadata: {},
    },
  );

  return cancelExportRunResponseSchema.parse({
    data: {
      id: runId,
      sourceType: detail.sourceType,
      status: "CANCELLED",
    },
  });
}

export async function retryExportRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
  body: ExportRunActionBody = {},
) {
  const detail = await resolveSource(tx, ctx, runId, body.sourceType);
  if (!detail.canRetry) {
    throw invalidExportAction("This export cannot be re-run.");
  }

  if (detail.sourceType === "report_run") {
    if (!detail.definitionKey) {
      throw invalidExportAction("This export no longer has a report definition.");
    }
    const format =
      detail.format === "xlsx" || detail.format === "pdf" || detail.format === "json"
        ? detail.format
        : "csv";
    const created = await createReportRun(
      tx,
      ctx,
      {
        definitionKey: detail.definitionKey,
        format,
        params: detail.params,
      },
      { processInline: true },
    );
    return retryExportRunResponseSchema.parse({
      data: {
        id: created.data.id,
        sourceType: "report_run",
        status: created.data.status,
      },
    });
  }

  const created = await createExportJob(tx, ctx);
  return retryExportRunResponseSchema.parse({
    data: {
      id: created.data.id,
      sourceType: "export_job",
      status: created.data.status,
    },
  });
}
