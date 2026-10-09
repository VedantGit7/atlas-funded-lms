import { auditWriter } from "@atlas/audit";
import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import type { ServiceCtx } from "./reports.types";
import { JOB_STATUSES, type JobStatus, type ReportFormat } from "./reports.contract";
import {
  REPORT_GENERATE_REQUESTED_AUDIT,
  REPORT_GENERATE_REQUESTED_EVENT,
  REPORT_SCHEDULE_DELETED_AUDIT,
  REPORT_SCHEDULE_UPDATED_AUDIT,
  reportGenerateRequestedPayloadSchema,
} from "./reports.events";
import { reportScheduleNotFound } from "./reports.errors";
import { processReportGenerate } from "./reports.worker";
import { reportsRepository } from "./reports.repository";
import {
  schedulesRosterBulkResponseSchema,
  schedulesRosterListResponseSchema,
  runScheduleNowResponseSchema,
  type SchedulesRosterBulkBody,
  type SchedulesRosterListQuery,
} from "./schedules-roster.dto";
import {
  cadenceLabel,
  classifyCadence,
  parseDelivery,
  schedulesRosterRepository,
  type ScheduleRosterRow,
} from "./schedules-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function asFormats(value: unknown): ReportFormat[] {
  if (!Array.isArray(value)) return ["csv"];
  const formats = value.filter(
    (item): item is ReportFormat =>
      item === "csv" || item === "xlsx" || item === "pdf" || item === "json",
  );
  return formats.length > 0 ? formats : ["csv"];
}

function asJobStatus(value: string | null): JobStatus | null {
  if (!value) return null;
  if ((JOB_STATUSES as readonly string[]).includes(value)) return value as JobStatus;
  return "FAILED";
}

function ownerInitials(name: string | null, membershipId: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0] ?? "";
      const second = parts[1] ?? "";
      return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  return membershipId.slice(0, 2).toUpperCase();
}

function mapDestinations(deliveryJson: unknown) {
  const parsed = parseDelivery(deliveryJson);
  return parsed.kinds.map((kind) => {
    if (kind === "email") {
      return {
        kind,
        label: "Email",
        detail: parsed.emails.length > 0 ? `${parsed.emails.length} recipient(s)` : null,
      };
    }
    if (kind === "webhook") {
      return {
        kind,
        label: "Webhook",
        detail: parsed.webhookHost,
      };
    }
    if (kind === "storage") {
      return {
        kind,
        label: "Storage",
        detail: parsed.storageLabel,
      };
    }
    return { kind, label: "Download", detail: null };
  });
}

function mapItem(row: ScheduleRosterRow) {
  const formats = asFormats(row.formats_json);
  const cadenceKind = classifyCadence(row.cron_expression);
  const delivery = parseDelivery(row.delivery_json);
  const consecutiveFailures = row.consecutive_failures;
  const isFailing = consecutiveFailures >= 1 && row.last_run_status === "FAILED";
  const name = row.name?.trim() || row.definition_title;

  return {
    id: row.id,
    name,
    definitionKey: row.definition_key,
    definitionTitle: row.definition_title,
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    cadenceLabel: cadenceLabel(row.cron_expression, row.timezone),
    cadenceKind,
    formats,
    primaryFormat: formats[0] ?? "csv",
    destinations: mapDestinations(row.delivery_json),
    isExternal: delivery.isExternal,
    isActive: row.is_active,
    isFailing,
    consecutiveFailures,
    nextRunAt: row.is_active ? row.next_run_at.toISOString() : null,
    lastRunAt: row.last_run_at?.toISOString() ?? null,
    lastRunStatus: asJobStatus(row.last_run_status),
    lastRunRowCount: row.last_run_row_count,
    lastRunErrorMessage: row.last_run_error_message,
    pastRunCount: row.past_run_count,
    ownerMembershipId: row.created_by_membership_id,
    ownerName: row.owner_name,
    ownerInitials: ownerInitials(row.owner_name, row.created_by_membership_id),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function matchesFilters(
  item: ReturnType<typeof mapItem>,
  query: SchedulesRosterListQuery,
): boolean {
  const status = query.status;
  if (status === "enabled" && !item.isActive) return false;
  if (status === "paused" && item.isActive) return false;
  if (status === "failing" && !item.isFailing) return false;

  const cadence = query.cadence;
  if (cadence !== "any" && item.cadenceKind !== cadence) return false;

  const destination = query.destination;
  if (destination !== "any") {
    const has = item.destinations.some((d) => d.kind === destination);
    if (!has) return false;
  }

  return true;
}

function sortItems(
  items: Array<ReturnType<typeof mapItem>>,
  sort: SchedulesRosterListQuery["sort"],
) {
  const copy = [...items];
  switch (sort) {
    case "last_run_desc":
      return copy.sort((a, b) => {
        const at = a.lastRunAt ? Date.parse(a.lastRunAt) : 0;
        const bt = b.lastRunAt ? Date.parse(b.lastRunAt) : 0;
        return bt - at;
      });
    case "name_asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "failures_desc":
      return copy.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
    case "next_run_asc":
    default:
      return copy.sort((a, b) => {
        if (!a.isActive && b.isActive) return 1;
        if (a.isActive && !b.isActive) return -1;
        const at = a.nextRunAt ? Date.parse(a.nextRunAt) : Number.MAX_SAFE_INTEGER;
        const bt = b.nextRunAt ? Date.parse(b.nextRunAt) : Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
  }
}

export async function listSchedulesRoster(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: SchedulesRosterListQuery,
) {
  const [summary, listed] = await Promise.all([
    schedulesRosterRepository.summarize(tx),
    schedulesRosterRepository.list(tx, query),
  ]);

  const mapped = listed.rows.map(mapItem).filter((item) => matchesFilters(item, query));
  const sorted = sortItems(mapped, query.sort);
  const offset = (query.page - 1) * query.limit;
  const pageItems = sorted.slice(offset, offset + query.limit);

  return schedulesRosterListResponseSchema.parse({
    data: {
      items: pageItems,
      pageInfo: pageInfo(sorted.length, query.page, query.limit),
      summary: {
        totalCount: summary.totalCount,
        enabledCount: summary.enabledCount,
        pausedCount: summary.pausedCount,
        runsThisMonth: summary.runsThisMonth,
        runsSucceededThisMonth: summary.runsSucceededThisMonth,
        runsFailedThisMonth: summary.runsFailedThisMonth,
        nextRunAt: summary.nextRunAt?.toISOString() ?? null,
        nextScheduleName: summary.nextScheduleName,
        failingCount: summary.failingCount,
        maxConsecutiveFailures: summary.maxConsecutiveFailures,
        externalDeliveryCount: summary.externalDeliveryCount,
      },
    },
  });
}

export async function runReportScheduleNow(tx: TenantTx, ctx: ServiceCtx, scheduleId: string) {
  const schedule = await reportsRepository.findScheduleById(tx, scheduleId);
  if (!schedule || schedule.tenant_id !== ctx.tenantId) {
    throw reportScheduleNotFound();
  }

  const formats = asFormats(schedule.formats_json);
  const format = formats[0] === "pdf" ? "csv" : (formats[0] ?? "csv");
  const params =
    schedule.params_json &&
    typeof schedule.params_json === "object" &&
    !Array.isArray(schedule.params_json)
      ? (schedule.params_json as Record<string, unknown>)
      : {};

  const created = await reportsRepository.insertReportRun(tx, {
    reportDefinitionId: schedule.report_definition_id,
    reportScheduleId: schedule.id,
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
        definitionKey: schedule.definition_key,
        format,
        scheduleId: schedule.id,
      },
      reason: null,
      metadata: { triggered: "run_now" },
    },
  );

  const payload = reportGenerateRequestedPayloadSchema.parse({
    reportRunId: created.id,
    reportDefinitionKey: schedule.definition_key,
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
    idempotencyKey: ctx.idempotencyKey ?? `${ctx.requestId}:schedule-run-now:${schedule.id}`,
  });

  await processReportGenerate(tx, ctx, {
    id: created.id,
    eventType: REPORT_GENERATE_REQUESTED_EVENT,
    payload,
  });

  const hydrated = await reportsRepository.findReportRunById(tx, created.id);
  if (!hydrated) {
    throw reportScheduleNotFound();
  }

  return runScheduleNowResponseSchema.parse({
    data: {
      scheduleId: schedule.id,
      runId: hydrated.id,
      status: hydrated.status,
    },
  });
}

export async function bulkMutateSchedules(
  tx: TenantTx,
  ctx: ServiceCtx,
  body: SchedulesRosterBulkBody,
) {
  let processed = 0;
  let failed = 0;
  const runIds: string[] = [];

  for (const id of body.ids) {
    try {
      if (body.action === "delete") {
        const existing = await reportsRepository.findScheduleById(tx, id);
        if (!existing || existing.tenant_id !== ctx.tenantId) {
          failed += 1;
          continue;
        }
        const deleted = await reportsRepository.deleteSchedule(tx, id);
        if (!deleted) {
          failed += 1;
          continue;
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
            target: { type: "report_schedule", id },
            before: { definitionKey: existing.definition_key },
            after: null,
            reason: null,
            metadata: { bulk: true },
          },
        );
        processed += 1;
        continue;
      }

      if (body.action === "pause" || body.action === "enable") {
        const existing = await reportsRepository.findScheduleById(tx, id);
        if (!existing || existing.tenant_id !== ctx.tenantId) {
          failed += 1;
          continue;
        }
        const isActive = body.action === "enable";
        const updated = await reportsRepository.updateSchedule(tx, {
          scheduleId: id,
          isActive,
        });
        if (!updated) {
          failed += 1;
          continue;
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
            target: { type: "report_schedule", id },
            before: { isActive: existing.is_active },
            after: { isActive },
            reason: null,
            metadata: { bulk: true, action: body.action },
          },
        );
        processed += 1;
        continue;
      }

      {
        const result = await runReportScheduleNow(tx, ctx, id);
        runIds.push(result.data.runId);
        processed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return schedulesRosterBulkResponseSchema.parse({
    data: {
      action: body.action,
      processed,
      failed,
      ...(runIds.length > 0 ? { runIds } : {}),
    },
  });
}
