import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  RU_EXPORT_COLUMNS,
  RU_EXPORT_DATASETS,
  createResourceUsageExportBodySchema,
  createResourceUsageExportResponseSchema,
  deleteResourceUsageExportScheduleResponseSchema,
  resourceUsageExportRunDetailResponseSchema,
  resourceUsageExportsResponseSchema,
  retryResourceUsageExportResponseSchema,
  updateResourceUsageExportScheduleBodySchema,
  updateResourceUsageExportScheduleResponseSchema,
  type CreateResourceUsageExportBody,
} from "./resource-usage-exports.dto";
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

const DEFINITION_KEY = "resource-usage";

type RuExportDataset = (typeof RU_EXPORT_DATASETS)[number];

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

function datasetLabel(dataset: RuExportDataset): string {
  if (dataset === "metric_history") return "Metric history";
  if (dataset === "storage_breakdown") return "Storage breakdown";
  if (dataset === "inactive_learners") return "Inactive learners";
  if (dataset === "dormant_content") return "Dormant content";
  return "Meter snapshot";
}

function normalizeDataset(value: unknown): RuExportDataset {
  if (typeof value === "string" && (RU_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as RuExportDataset;
  }
  if (value === "history") return "metric_history";
  if (value === "inactive") return "inactive_learners";
  if (value === "dormant") return "dormant_content";
  if (value === "storage") return "storage_breakdown";
  return "meter_snapshot";
}

function reportTabForDataset(dataset: RuExportDataset): string {
  if (dataset === "metric_history") return "history";
  if (dataset === "storage_breakdown") return "storage";
  if (dataset === "inactive_learners") return "inactive";
  if (dataset === "dormant_content") return "dormant";
  return "meter_snapshot";
}

function fileNameFor(dataset: RuExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "export"
    : date.toISOString().slice(0, 10).replace(/-/g, "");
  const ext = format === "json" ? "json" : format;
  return `resource-usage-${dataset.replace(/_/g, "-")}-${stamp}.${ext}`;
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

function resolveDateRange(body: CreateResourceUsageExportBody): {
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
  if (typeof params["metricKey"] === "string" && params["metricKey"].trim()) {
    parts.push(params["metricKey"].trim());
  }
  const from = formatDateShort(
    typeof params["startedFrom"] === "string" ? params["startedFrom"] : undefined,
  );
  const to = formatDateShort(
    typeof params["startedTo"] === "string" ? params["startedTo"] : undefined,
  );
  if (from && to) parts.push(`${from} - ${to}`);
  else if (from) parts.push(`From ${from}`);
  else if (to) parts.push(`Until ${to}`);
  else if (normalizeDataset(params["dataset"] ?? params["reportTab"]) === "meter_snapshot") {
    parts.push("As of now");
  } else {
    parts.push("All time");
  }
  if (typeof params["q"] === "string" && params["q"].trim()) {
    parts.push(`Search: ${params["q"].trim()}`);
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export failed while assembling usage rows. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested dataset exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Resource usage report definition was not found.";
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
    name: schedule.name?.trim() || schedule.definitionTitle || "Usage export",
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

function defaultColumnsForDataset(dataset: RuExportDataset): string[] {
  if (dataset === "storage_breakdown") {
    return ["resource_type", "object_count", "storage_gb"];
  }
  if (dataset === "inactive_learners") {
    return ["membership_id", "learner_name", "email", "status", "last_active_at", "created_at"];
  }
  if (dataset === "dormant_content") {
    return [
      "course_id",
      "title",
      "status",
      "lesson_count",
      "storage_gb",
      "last_learner_activity_at",
      "created_at",
    ];
  }
  if (dataset === "metric_history") {
    return ["metric_key", "metric_label", "period", "value", "unit", "calculated_at"];
  }
  return ["metric_key", "metric_label", "value", "unit", "calculated_at"];
}

function buildRunParams(body: CreateResourceUsageExportBody): Record<string, unknown> {
  const range = resolveDateRange(body);
  const columns =
    body.columns && body.columns.length > 0 ? body.columns : defaultColumnsForDataset(body.dataset);

  const params: Record<string, unknown> = {
    dataset: body.dataset,
    reportTab: reportTabForDataset(body.dataset),
    scopeMode: body.scopeMode,
    datePreset: body.datePreset,
    columns,
    selectedColumns: columns,
  };

  if (body.dataset === "metric_history") {
    if (range.startedFrom) params["startedFrom"] = range.startedFrom;
    if (range.startedTo) params["startedTo"] = range.startedTo;
  }
  if (body.metricKey?.trim()) params["metricKey"] = body.metricKey.trim();
  if (body.q?.trim()) params["q"] = body.q.trim();
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
  meterSnapshotRows: number | null;
  inactiveLearnerRows: number | null;
}> {
  try {
    const [meterRows, inactiveRows] = await Promise.all([
      tx.$queryRaw<Array<{ count: number }>>`
        select count(distinct rollup_key)::int as count
        from analytics_rollups
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and rollup_key like 'usage.%'
      `,
      tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count
        from memberships m
        join user_roles ur on ur.membership_id = m.id
        join roles r on r.id = ur.role_id and r.key = 'learner'
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and m.status = 'ACTIVE'
          and (m.last_active_at is null or m.last_active_at < now() - interval '90 days')
      `,
    ]);
    return {
      meterSnapshotRows: meterRows[0]?.count ?? 0,
      inactiveLearnerRows: inactiveRows[0]?.count ?? 0,
    };
  } catch {
    return { meterSnapshotRows: null, inactiveLearnerRows: null };
  }
}

export async function getResourceUsageExports(tx: TenantTx, ctx: ServiceCtx) {
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

  const ruSchedules = schedules.data.items
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

  return resourceUsageExportsResponseSchema.parse({
    data: {
      history,
      schedules: ruSchedules,
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...RU_EXPORT_DATASETS],
        columns: [...RU_EXPORT_COLUMNS],
        canSchedule: true,
        canEmailDelivery: true,
        note: "Ready files are deleted after 7 days. Choose a dataset, then narrow scope before exporting.",
        unmeteredNote:
          "Bandwidth, DRM tokens, and video transcoding are not metered on this account and will export as empty, not zero.",
      },
      estimates,
    },
  });
}

export async function createResourceUsageExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateResourceUsageExportBody,
) {
  const body = createResourceUsageExportBodySchema.parse(input);
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

  return createResourceUsageExportResponseSchema.parse({
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

export async function getResourceUsageExportRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return resourceUsageExportRunDetailResponseSchema.parse({
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

export async function retryResourceUsageExport(tx: TenantTx, ctx: ServiceCtx, runId: string) {
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

  return retryResourceUsageExportResponseSchema.parse({
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

export async function updateResourceUsageExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean | undefined; name?: string | undefined },
) {
  const body = updateResourceUsageExportScheduleBodySchema.parse(input);
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

  return updateResourceUsageExportScheduleResponseSchema.parse({
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

export async function deleteResourceUsageExportSchedule(
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
  return deleteResourceUsageExportScheduleResponseSchema.parse({
    data: { deleted: true as const, id: scheduleId },
  });
}

export async function runResourceUsageExportScheduleNow(
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

  return createResourceUsageExportResponseSchema.parse({
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
