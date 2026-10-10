import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import { customFieldRosterRepository } from "./custom-field-roster.repository";
import {
  CUSTOM_FIELD_EXPORT_DATASETS,
  LEARNER_CORE_EXPORT_COLUMNS,
  createCustomFieldExportBodySchema,
  createCustomFieldExportResponseSchema,
  customFieldExportRunDetailResponseSchema,
  customFieldExportsResponseSchema,
  retryCustomFieldExportResponseSchema,
  updateCustomFieldExportScheduleResponseSchema,
  type CreateCustomFieldExportBody,
} from "./custom-field-exports.dto";
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
  type ExportRun,
  type ExportScheduleView,
  type ExportViewSpec,
} from "./report-exports.kit";
import {
  deleteReportExportScheduleResponseSchema,
  updateReportExportScheduleBodySchema,
} from "./report-exports.dto";

const DEFINITION_KEY = "custom-field";

type CustomFieldDataset = (typeof CUSTOM_FIELD_EXPORT_DATASETS)[number];

function datasetLabel(dataset: CustomFieldDataset): string {
  if (dataset === "field_coverage") return "Field coverage";
  if (dataset === "segment_members") return "Segment members";
  return "Learner roster";
}

function normalizeDataset(value: unknown): CustomFieldDataset {
  if (
    typeof value === "string" &&
    (CUSTOM_FIELD_EXPORT_DATASETS as readonly string[]).includes(value)
  ) {
    return value as CustomFieldDataset;
  }
  // Legacy roster exports stored no reportTab / used filters only
  return "learner_roster";
}

function typeBadgeFor(fieldType: string): string {
  const t = fieldType.toUpperCase();
  if (t.includes("BOOL")) return "bol";
  if (t.includes("NUM") || t.includes("INT") || t.includes("DEC")) return "num";
  if (t.includes("DATE") || t.includes("TIME")) return "date";
  if (t.includes("SELECT") || t.includes("ENUM") || t.includes("OPTION")) return "sel";
  return "txt";
}

function fileNameFor(dataset: CustomFieldDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const slug =
    dataset === "field_coverage"
      ? "field-coverage"
      : dataset === "segment_members"
        ? "segment-members"
        : "learners";
  return `custom-field-${slug}-${stamp}.${format === "json" ? "json" : format}`;
}

function scopeLabelFromParams(params: Record<string, unknown>): string {
  const parts: string[] = [];
  const segmentName = params["segmentName"];
  const segmentId = params["segmentId"];
  if (typeof segmentName === "string" && segmentName.trim()) {
    parts.push(`Segment · ${segmentName.trim()}`);
  } else if (typeof segmentId === "string" && segmentId.trim()) {
    parts.push("Segment scoped");
  } else if (typeof params["status"] === "string" && params["status"].trim()) {
    parts.push(`Status · ${params["status"]}`);
  } else {
    parts.push("All learners");
  }
  if (typeof params["q"] === "string" && params["q"].trim()) {
    parts.push(`Search · ${params["q"].trim()}`);
  }
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the custom field artifact.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Custom field report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

const view: ExportViewSpec<CustomFieldDataset> = {
  datasetParams: ["reportTab", "dataset"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: false,
  columns: true,
  defaultScheduleName: "Custom field export",
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
    runDetail: customFieldExportRunDetailResponseSchema,
    retry: retryCustomFieldExportResponseSchema,
    updateScheduleBody: updateReportExportScheduleBodySchema,
    updateSchedule: updateCustomFieldExportScheduleResponseSchema,
    deleteSchedule: deleteReportExportScheduleResponseSchema,
  },
});

function buildRunParams(body: CreateCustomFieldExportBody): Record<string, unknown> {
  const params: Record<string, unknown> = {
    reportTab: body.dataset,
    dataset: body.dataset,
    columns: body.columns,
    emptyValueMode: body.emptyValueMode,
  };
  if (body.q) params["q"] = body.q;
  if (body.email) params["email"] = body.email;
  if (body.status) params["status"] = body.status;
  if (body.signedUpFrom) params["signedUpFrom"] = body.signedUpFrom;
  if (body.signedUpTo) params["signedUpTo"] = body.signedUpTo;
  if (body.minTotalSpentCents != null) params["minTotalSpentCents"] = body.minTotalSpentCents;
  if (body.maxTotalSpentCents != null) params["maxTotalSpentCents"] = body.maxTotalSpentCents;
  if (body.segmentId) params["segmentId"] = body.segmentId;
  if (body.segmentName) params["segmentName"] = body.segmentName;
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

export async function getCustomFieldExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules, fieldDefs] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
    customFieldRosterRepository.listFieldDefinitions(tx),
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

  const cfSchedules = schedules.data.items
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

  const customFieldColumns = fieldDefs.map((field) => ({
    key: `cf:${field.key}`,
    label: field.label,
    sensitive: false,
    defaultSelected: false,
    group: "custom" as const,
    typeBadge: typeBadgeFor(field.field_type),
    fieldType: field.field_type,
  }));

  return customFieldExportsResponseSchema.parse({
    data: {
      history,
      schedules: cfSchedules,
      learnerColumns: LEARNER_CORE_EXPORT_COLUMNS.map((column) => ({
        key: column.key,
        label: column.label,
        sensitive: column.sensitive,
        defaultSelected: column.defaultSelected,
        group: column.group,
        typeBadge: column.typeBadge,
        fieldType: null,
      })),
      customFieldColumns,
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...CUSTOM_FIELD_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        note: "Exports generate from custom-field learner datasets. Field coverage and segment member scopes use the same report runner. Email and webhook delivery run after the artifact is ready. Ready files expire after the signed download TTL.",
      },
    },
  });
}

export async function createCustomFieldExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateCustomFieldExportBody,
) {
  const body = createCustomFieldExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.delivery === "recipients" && (!body.recipients || body.recipients.length === 0)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Add at least one recipient email for recipient delivery.",
    });
  }

  if (body.dataset === "segment_members" && !body.segmentId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Select a segment for segment member exports.",
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

  return createCustomFieldExportResponseSchema.parse({
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

export const getCustomFieldExportRun = operations.getRun;
export const retryCustomFieldExport = operations.retry;
export const updateCustomFieldExportSchedule = operations.updateSchedule;
export const deleteCustomFieldExportSchedule = operations.deleteSchedule;
