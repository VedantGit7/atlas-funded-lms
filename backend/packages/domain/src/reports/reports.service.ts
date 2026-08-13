import { auditWriter } from "@atlas/audit";
import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { assertTenantKeyPrefix, getStorageProvider, parseStorageEnv } from "@atlas/storage";
import { CronExpressionParser } from "cron-parser";
import type { ReportFormat } from "./reports.contract";
import {
  createCustomReportDefinitionBodySchema,
  createCustomReportDefinitionResponseSchema,
  createReportRunBodySchema,
  createReportRunResponseSchema,
  createReportScheduleBodySchema,
  createReportScheduleResponseSchema,
  deleteReportScheduleResponseSchema,
  reportDefinitionListResponseSchema,
  reportListQuerySchema,
  reportRunDetailResponseSchema,
  reportRunListResponseSchema,
  reportScheduleListResponseSchema,
  reportTickResponseSchema,
  updateReportScheduleBodySchema,
  updateReportScheduleResponseSchema,
  type CreateCustomReportDefinitionBody,
  type CreateReportRunBody,
  type CreateReportScheduleBody,
  type ReportListQuery,
  type UpdateReportScheduleBody,
} from "./reports.dto";
import { buildReportDataset } from "./reports.datasets";
import {
  REPORT_GENERATE_REQUESTED_AUDIT,
  REPORT_GENERATE_REQUESTED_EVENT,
  REPORT_SCHEDULE_CREATED_AUDIT,
  REPORT_SCHEDULE_DELETED_AUDIT,
  REPORT_SCHEDULE_UPDATED_AUDIT,
  reportGenerateRequestedPayloadSchema,
} from "./reports.events";
import {
  customReportKeyConflict,
  invalidReportColumns,
  invalidReportParams,
  reportDefinitionNotFound,
  reportRunNotFound,
  reportScheduleNotFound,
} from "./reports.errors";
import { reportsRepository } from "./reports.repository";
import {
  SYSTEM_REPORT_DEFINITIONS,
  getSystemReportDefinition,
  getSystemReportDefinitionByDatasetKey,
} from "./reports.registry";
import {
  extractSelectedColumns,
  getAllowedColumnsForDataset,
  validateSelectedColumns,
  withSelectedColumns,
} from "./reports.allowed-columns";
import { processReportGenerate } from "./reports.worker";
import type {
  ReportDefinitionRow,
  ReportRunRow,
  ReportScheduleRow,
  ServiceCtx,
} from "./reports.types";

function mapRunErrorCode(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const code = (errorJson as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function mapRunErrorMessage(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const message = (errorJson as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : null;
}

function mapRunErrorTrace(errorJson: unknown): string[] | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const trace = (errorJson as { trace?: unknown }).trace;
  if (!Array.isArray(trace)) return null;
  const lines = trace.filter((item): item is string => typeof item === "string");
  return lines.length > 0 ? lines : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): ReportFormat[] {
  if (!Array.isArray(value)) {
    return ["csv"];
  }
  return value.filter(
    (item): item is ReportFormat =>
      item === "csv" || item === "xlsx" || item === "pdf" || item === "json",
  );
}

const CADENCE_ALIAS_TO_CRON: Record<string, string> = {
  hourly: "0 * * * *",
  daily: "0 0 * * *",
  weekly: "0 0 * * 1",
  monthly: "0 0 1 * *",
};

function normalizeCronExpression(cronExpression: string): string {
  const trimmed = cronExpression.trim();
  const alias = CADENCE_ALIAS_TO_CRON[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

/**
 * Compute the next fire time for a 5-field cron expression (or cadence alias),
 * respecting the schedule timezone when provided.
 */
export function computeNextRunAt(cronExpression: string, from: Date, timezone = "UTC"): Date {
  const expr = normalizeCronExpression(cronExpression);
  try {
    const interval = CronExpressionParser.parse(expr, {
      currentDate: from,
      tz: timezone.trim() || "UTC",
    });
    return interval.next().toDate();
  } catch {
    // Invalid cron — keep schedules moving rather than stalling forever.
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}

function mapDefinitionDto(definition: ReportDefinitionRow) {
  const paramSchema = asRecord(definition.param_schema_json);
  const selectedColumns = extractSelectedColumns(definition.param_schema_json);
  const columns =
    definition.scope === "tenant" && selectedColumns.length > 0
      ? selectedColumns
      : [...getAllowedColumnsForDataset(definition.dataset_key)];

  return {
    id: definition.id,
    key: definition.key,
    category: definition.category,
    title: definition.title,
    description: definition.description,
    paramSchema,
    datasetKey: definition.dataset_key,
    columns,
    defaultFormat: definition.default_format as ReportFormat,
    scope: definition.scope,
    createdAt: definition.created_at.toISOString(),
    updatedAt: definition.updated_at.toISOString(),
  };
}

function mapRunBaseDto(run: ReportRunRow & { definition_key: string; definition_title: string }) {
  return {
    id: run.id,
    definitionKey: run.definition_key,
    definitionTitle: run.definition_title,
    status: run.status,
    format: run.format,
    params: asRecord(run.params_json),
    rowCount: run.row_count,
    progressPercent: run.progress_percent,
    requestedByMembershipId: run.requested_by_membership_id,
    scheduleId: run.report_schedule_id,
    createdAt: run.created_at.toISOString(),
    updatedAt: run.updated_at.toISOString(),
    startedAt: run.started_at?.toISOString() ?? null,
    completedAt: run.completed_at?.toISOString() ?? null,
    expiresAt: run.expires_at?.toISOString() ?? null,
    errorCode: mapRunErrorCode(run.error_json),
    errorMessage: mapRunErrorMessage(run.error_json),
    errorTrace: mapRunErrorTrace(run.error_json),
  };
}

function mapScheduleDto(
  schedule: ReportScheduleRow & { definition_key: string; definition_title: string },
) {
  return {
    id: schedule.id,
    definitionKey: schedule.definition_key,
    definitionTitle: schedule.definition_title,
    name: schedule.name,
    cronExpression: schedule.cron_expression,
    timezone: schedule.timezone,
    params: asRecord(schedule.params_json),
    formats: asStringArray(schedule.formats_json),
    delivery:
      schedule.delivery_json && typeof schedule.delivery_json === "object"
        ? asRecord(schedule.delivery_json)
        : null,
    nextRunAt: schedule.next_run_at.toISOString(),
    isActive: schedule.is_active,
    createdByMembershipId: schedule.created_by_membership_id,
    createdAt: schedule.created_at.toISOString(),
    updatedAt: schedule.updated_at.toISOString(),
  };
}

async function resolveSignedDownload(
  ctx: ServiceCtx,
  run: ReportRunRow,
): Promise<{ url: string; expiresAt: string } | null> {
  if (run.status !== "SUCCEEDED" || !run.r2_object_key) {
    return null;
  }

  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key: run.r2_object_key,
  });

  const signed = await provider.createSignedDownloadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: run.r2_object_key,
    expiresInSeconds: env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
  });

  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

export async function ensureTenantReportDefinitions(tx: TenantTx): Promise<void> {
  for (const definition of SYSTEM_REPORT_DEFINITIONS) {
    await reportsRepository.upsertSystemDefinition(tx, definition);
  }
}

export async function createCustomReportDefinition(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body: CreateCustomReportDefinitionBody =
    createCustomReportDefinitionBodySchema.parse(rawBody);

  const columnValidation = validateSelectedColumns({
    datasetKey: body.datasetKey,
    columns: body.columns,
  });
  if (!columnValidation.ok) {
    throw invalidReportColumns(columnValidation.message);
  }

  const systemDefinition = getSystemReportDefinitionByDatasetKey(body.datasetKey);
  const baseParamSchema = systemDefinition?.paramSchemaJson ?? {
    type: "object",
    additionalProperties: false,
    properties: {},
  };

  const key =
    body.key ??
    `custom-${body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)}`;

  const existing = await reportsRepository.findDefinitionByKey(tx, key);
  if (existing) {
    throw customReportKeyConflict();
  }

  const created = await reportsRepository.insertTenantDefinition(tx, {
    key,
    category: "custom",
    title: body.title,
    description: body.description ?? null,
    paramSchemaJson: withSelectedColumns(baseParamSchema, columnValidation.columns),
    datasetKey: body.datasetKey,
    defaultFormat: "csv",
  });

  void ctx;

  return createCustomReportDefinitionResponseSchema.parse({
    data: mapDefinitionDto(created),
  });
}

export async function listReportDefinitions(tx: TenantTx, ctx: ServiceCtx) {
  void ctx;
  await ensureTenantReportDefinitions(tx);
  const rows = await reportsRepository.listDefinitions(tx);

  return reportDefinitionListResponseSchema.parse({
    data: {
      items: rows.map(mapDefinitionDto),
    },
  });
}

export async function listReportRuns(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query: ReportListQuery = reportListQuerySchema.parse(rawQuery ?? {});
  const rows = await reportsRepository.listReportRuns(tx, {
    limit: query.limit,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    ...(query.definitionKey !== undefined ? { definitionKey: query.definitionKey } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;

  return reportRunListResponseSchema.parse({
    data: {
      items: pageRows.map(mapRunBaseDto),
      pageInfo: {
        nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function createReportRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
  options?: { processInline?: boolean },
) {
  const body: CreateReportRunBody = createReportRunBodySchema.parse(rawBody);
  await ensureTenantReportDefinitions(tx);

  const definition = await reportsRepository.findDefinitionByKey(tx, body.definitionKey);
  if (!definition) {
    throw reportDefinitionNotFound();
  }

  if (definition.scope === "system") {
    const systemDefinition = getSystemReportDefinition(body.definitionKey);
    if (!systemDefinition) {
      throw reportDefinitionNotFound();
    }
  }

  const format = body.format ?? (definition.default_format as ReportFormat);

  const params = body.params ?? {};
  if (typeof params !== "object" || Array.isArray(params)) {
    throw invalidReportParams("Report params must be an object.");
  }

  const created = await reportsRepository.insertReportRun(tx, {
    reportDefinitionId: definition.id,
    requestedByMembershipId: ctx.actorMembershipId,
    paramsJson: params,
    format,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: REPORT_GENERATE_REQUESTED_AUDIT,
      target: { type: "report_run", id: created.id },
      before: null,
      after: {
        status: created.status,
        definitionKey: definition.key,
        format,
      },
      reason: null,
      metadata: {},
    },
  );

  const payload = reportGenerateRequestedPayloadSchema.parse({
    reportRunId: created.id,
    reportDefinitionKey: definition.key,
    requestedAt: new Date().toISOString(),
    requestedByMembershipId: ctx.actorMembershipId,
    format,
    schemaVersion: 1,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: REPORT_GENERATE_REQUESTED_EVENT,
    aggregateType: "report_run",
    aggregateId: created.id,
    payload,
    idempotencyKey: ctx.idempotencyKey ?? `${ctx.requestId}:report:${created.id}`,
  });

  const processInline = options?.processInline !== false;
  if (processInline) {
    // Process inline so runs complete without a separate worker drain.
    // Outbox event remains for idempotent replay / observability.
    await processReportGenerate(tx, ctx, {
      id: created.id,
      eventType: REPORT_GENERATE_REQUESTED_EVENT,
      payload,
    });
  }

  const hydrated = await reportsRepository.findReportRunById(tx, created.id);
  if (!hydrated) {
    throw reportRunNotFound();
  }

  return createReportRunResponseSchema.parse({
    data: mapRunBaseDto(hydrated),
  });
}

export async function getReportRun(tx: TenantTx, ctx: ServiceCtx, reportRunId: string) {
  const run = await reportsRepository.findReportRunById(tx, reportRunId);
  if (!run || run.tenant_id !== ctx.tenantId) {
    throw reportRunNotFound();
  }

  const download = await resolveSignedDownload(ctx, run);

  return reportRunDetailResponseSchema.parse({
    data: {
      ...mapRunBaseDto(run),
      download,
    },
  });
}

export async function listReportSchedules(tx: TenantTx, ctx: ServiceCtx) {
  void ctx;
  await ensureTenantReportDefinitions(tx);
  const rows = await reportsRepository.listSchedules(tx);

  return reportScheduleListResponseSchema.parse({
    data: {
      items: rows.map(mapScheduleDto),
    },
  });
}

export async function createReportSchedule(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body: CreateReportScheduleBody = createReportScheduleBodySchema.parse(rawBody);
  await ensureTenantReportDefinitions(tx);

  const definition = await reportsRepository.findDefinitionByKey(tx, body.definitionKey);
  if (!definition) {
    throw reportDefinitionNotFound();
  }

  const nextRunAt = computeNextRunAt(body.cronExpression, new Date(), body.timezone);
  const created = await reportsRepository.insertSchedule(tx, {
    reportDefinitionId: definition.id,
    createdByMembershipId: ctx.actorMembershipId,
    name: body.name ?? null,
    cronExpression: body.cronExpression,
    timezone: body.timezone,
    paramsJson: body.params ?? {},
    formatsJson: body.formats,
    deliveryJson: body.delivery ?? null,
    nextRunAt,
    isActive: body.isActive,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: REPORT_SCHEDULE_CREATED_AUDIT,
      target: { type: "report_schedule", id: created.id },
      before: null,
      after: {
        definitionKey: definition.key,
        cronExpression: created.cron_expression,
      },
      reason: null,
      metadata: {},
    },
  );

  const hydrated = await reportsRepository.findScheduleById(tx, created.id);
  if (!hydrated) {
    throw reportScheduleNotFound();
  }

  return createReportScheduleResponseSchema.parse({
    data: mapScheduleDto(hydrated),
  });
}

export async function updateReportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  rawBody: unknown,
) {
  const body: UpdateReportScheduleBody = updateReportScheduleBodySchema.parse(rawBody);
  const existing = await reportsRepository.findScheduleById(tx, scheduleId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw reportScheduleNotFound();
  }

  const nextRunAt =
    body.cronExpression !== undefined
      ? computeNextRunAt(body.cronExpression, new Date(), body.timezone ?? existing.timezone)
      : body.timezone !== undefined
        ? computeNextRunAt(existing.cron_expression, new Date(), body.timezone)
        : undefined;

  const updated = await reportsRepository.updateSchedule(tx, {
    scheduleId,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.cronExpression !== undefined ? { cronExpression: body.cronExpression } : {}),
    ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
    ...(body.params !== undefined ? { paramsJson: body.params } : {}),
    ...(body.formats !== undefined ? { formatsJson: body.formats } : {}),
    ...(body.delivery !== undefined ? { deliveryJson: body.delivery } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    ...(nextRunAt !== undefined ? { nextRunAt } : {}),
  });

  if (!updated) {
    throw reportScheduleNotFound();
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
      action: REPORT_SCHEDULE_UPDATED_AUDIT,
      target: { type: "report_schedule", id: scheduleId },
      before: {
        cronExpression: existing.cron_expression,
        isActive: existing.is_active,
      },
      after: {
        cronExpression: updated.cron_expression,
        isActive: updated.is_active,
      },
      reason: null,
      metadata: {},
    },
  );

  const hydrated = await reportsRepository.findScheduleById(tx, scheduleId);
  if (!hydrated) {
    throw reportScheduleNotFound();
  }

  return updateReportScheduleResponseSchema.parse({
    data: mapScheduleDto(hydrated),
  });
}

export async function deleteReportSchedule(tx: TenantTx, ctx: ServiceCtx, scheduleId: string) {
  const existing = await reportsRepository.findScheduleById(tx, scheduleId);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw reportScheduleNotFound();
  }

  const deleted = await reportsRepository.deleteSchedule(tx, scheduleId);
  if (!deleted) {
    throw reportScheduleNotFound();
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
      action: REPORT_SCHEDULE_DELETED_AUDIT,
      target: { type: "report_schedule", id: scheduleId },
      before: {
        definitionKey: existing.definition_key,
      },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return deleteReportScheduleResponseSchema.parse({
    data: {
      deleted: true,
      id: scheduleId,
    },
  });
}

export async function tickReportSchedules(tx: TenantTx, ctx: ServiceCtx) {
  void ctx;
  await ensureTenantReportDefinitions(tx);

  const asOf = new Date();
  const dueSchedules = await reportsRepository.listDueSchedules(tx, {
    asOf,
    limit: 50,
  });

  let runsEnqueued = 0;

  for (const schedule of dueSchedules) {
    const definition = await reportsRepository.findDefinitionById(
      tx,
      schedule.report_definition_id,
    );
    if (!definition) {
      continue;
    }

    const formats = asStringArray(schedule.formats_json);
    const format = formats[0] ?? "csv";
    const params = asRecord(schedule.params_json);

    const run = await reportsRepository.insertReportRun(tx, {
      reportDefinitionId: definition.id,
      reportScheduleId: schedule.id,
      requestedByMembershipId: schedule.created_by_membership_id,
      paramsJson: params,
      format,
    });

    const payload = reportGenerateRequestedPayloadSchema.parse({
      reportRunId: run.id,
      reportDefinitionKey: definition.key,
      requestedAt: new Date().toISOString(),
      requestedByMembershipId: schedule.created_by_membership_id,
      format,
      schemaVersion: 1,
    });

    await outbox.publish(tx, {
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: schedule.created_by_membership_id,
        requestId: ctx.requestId,
      },
      eventType: REPORT_GENERATE_REQUESTED_EVENT,
      aggregateType: "report_run",
      aggregateId: run.id,
      payload,
      idempotencyKey: `${ctx.requestId}:schedule:${schedule.id}:${asOf.toISOString()}`,
    });

    await reportsRepository.advanceScheduleNextRun(tx, {
      scheduleId: schedule.id,
      nextRunAt: computeNextRunAt(schedule.cron_expression, asOf, schedule.timezone),
    });

    runsEnqueued += 1;
  }

  return reportTickResponseSchema.parse({
    data: {
      tenantsProcessed: 1,
      schedulesClaimed: dueSchedules.length,
      runsEnqueued,
    },
  });
}

export async function loadReportRunResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  reportRunId: string;
}) {
  const run = await reportsRepository.findReportRunById(args.tx, args.reportRunId);
  if (!run || run.tenant_id !== args.tenantId) {
    throw reportRunNotFound();
  }

  return createTenantResourceRef({
    type: "report_run",
    id: run.id,
    tenantId: args.tenantId,
    ownerMembershipId: run.requested_by_membership_id,
  });
}

export async function loadReportScheduleResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  scheduleId: string;
}) {
  const schedule = await reportsRepository.findScheduleById(args.tx, args.scheduleId);
  if (!schedule || schedule.tenant_id !== args.tenantId) {
    throw reportScheduleNotFound();
  }

  return createTenantResourceRef({
    type: "report_schedule",
    id: schedule.id,
    tenantId: args.tenantId,
    ownerMembershipId: schedule.created_by_membership_id,
  });
}

export function loadReportCatalogResourceRef(args: { tenantId: string }) {
  return createTenantResourceRef({
    type: "report_definition",
    id: args.tenantId,
    tenantId: args.tenantId,
  });
}

export { mapRunBaseDto, mapDefinitionDto, buildReportDataset };
