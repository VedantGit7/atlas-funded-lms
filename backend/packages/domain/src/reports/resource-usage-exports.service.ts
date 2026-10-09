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

const DEFINITION_KEY = "resource-usage";

type RuExportDataset = (typeof RU_EXPORT_DATASETS)[number];

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

const view: ExportViewSpec<RuExportDataset> = {
  datasetParams: ["dataset", "reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: false,
  defaultScheduleName: "Usage export",
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
    runDetail: resourceUsageExportRunDetailResponseSchema,
    retry: retryResourceUsageExportResponseSchema,
    updateScheduleBody: updateResourceUsageExportScheduleBodySchema,
    updateSchedule: updateResourceUsageExportScheduleResponseSchema,
    deleteSchedule: deleteResourceUsageExportScheduleResponseSchema,
  },
});

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

export const getResourceUsageExportRun = operations.getRun;
export const retryResourceUsageExport = operations.retry;
export const updateResourceUsageExportSchedule = operations.updateSchedule;
export const deleteResourceUsageExportSchedule = operations.deleteSchedule;

export function runResourceUsageExportScheduleNow(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
) {
  return operations.runScheduleNow(tx, ctx, scheduleId, createResourceUsageExportResponseSchema);
}
