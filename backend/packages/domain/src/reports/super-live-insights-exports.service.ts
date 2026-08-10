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
  deleteReportSchedule,
  ensureTenantReportDefinitions,
  getReportRun,
  listReportRuns,
  listReportSchedules,
  updateReportSchedule,
} from "./reports.service";

const DEFINITION_KEY = "super-live-insights";

type SliExportDataset = (typeof SLI_EXPORT_DATASETS)[number];

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
    name: schedule.name?.trim() || schedule.definitionTitle || "Insights export",
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

export async function getSuperLiveInsightsExportRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return superLiveInsightsExportRunDetailResponseSchema.parse({
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

export async function retrySuperLiveInsightsExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
  options?: { format?: "csv" | "xlsx" | "json" },
) {
  const existing = await getReportRun(tx, ctx, runId);
  if (existing.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }

  const format = options?.format ?? (existing.data.format === "pdf" ? "csv" : existing.data.format);

  const runResult = await createReportRun(
    tx,
    ctx,
    {
      definitionKey: DEFINITION_KEY,
      format,
      params: existing.data.params,
    },
    { processInline: true },
  );

  return retrySuperLiveInsightsExportResponseSchema.parse({
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

export async function updateSuperLiveInsightsExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean | undefined; name?: string | undefined },
) {
  const body = updateSuperLiveInsightsExportScheduleBodySchema.parse(input);
  const schedules = await listReportSchedules(tx, ctx);
  const existing = schedules.data.items.find((item) => item.id === scheduleId);
  if (!existing || existing.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Schedule was not found.",
    });
  }

  const updated = await updateReportSchedule(tx, ctx, scheduleId, {
    isActive: body.isActive,
    name: body.name,
  });

  return updateSuperLiveInsightsExportScheduleResponseSchema.parse({
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

export async function deleteSuperLiveInsightsExportSchedule(
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

  await deleteReportSchedule(tx, ctx, scheduleId);
  return deleteSuperLiveInsightsExportScheduleResponseSchema.parse({
    data: { deleted: true as const, id: scheduleId },
  });
}

export async function runSuperLiveInsightsExportScheduleNow(
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

  const format = existing.formats[0] === "pdf" ? "csv" : (existing.formats[0] ?? "csv");
  const runResult = await createReportRun(
    tx,
    ctx,
    {
      definitionKey: DEFINITION_KEY,
      format,
      params: {
        ...existing.params,
        triggeredFromScheduleId: existing.id,
      },
    },
    { processInline: true },
  );

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
      schedule: mapScheduleItem({
        id: existing.id,
        name: existing.name,
        definitionTitle: existing.definitionTitle,
        cronExpression: existing.cronExpression,
        timezone: existing.timezone,
        formats: existing.formats,
        isActive: existing.isActive,
        nextRunAt: existing.nextRunAt,
        params: existing.params,
        delivery: existing.delivery,
      }),
    },
  });
}
