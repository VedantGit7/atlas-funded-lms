import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createReportRun,
  deleteReportSchedule,
  getReportRun,
  listReportRuns,
  listReportSchedules,
  updateReportSchedule,
} from "./reports.service";

/**
 * What every report's export page shares: the export history and schedule
 * views, and the run, retry and schedule operations over reports.service.
 * A report supplies its own wording (dataset labels, file names, scope labels,
 * error messages) and keeps its own list and create operations, whose filters
 * and capabilities differ.
 */

export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";

/** A report run as reports.service returns it; list items carry no download. */
export type ExportRun = {
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
};

export type ExportSchedule = {
  id: string;
  definitionKey: string;
  name: string | null;
  definitionTitle: string;
  cronExpression: string;
  timezone: string;
  formats: ExportFormat[];
  isActive: boolean;
  nextRunAt: string;
  params: Record<string, unknown>;
  delivery: Record<string, unknown> | null;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)}B`;
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function estimateSizeLabel(rowCount: number | null, format: string): string | null {
  if (rowCount == null || rowCount < 0) return null;
  const perRow = format === "xlsx" ? 120 : format === "json" ? 180 : 64;
  return `~${formatBytes(Math.max(rowCount, 1) * perRow)}`;
}

export function formatDateShort(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function nextRunLabel(nextRunAt: string): string {
  const date = new Date(nextRunAt);
  if (Number.isNaN(date.getTime())) return "Next run unknown";
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Due now";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 48) return `Next run in ${String(Math.max(1, hours))}h`;
  const days = Math.floor(hours / 24);
  return `Next run in ${String(days)} day${days === 1 ? "" : "s"}`;
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

export function columnsFromParams(params: Record<string, unknown>): string[] {
  const columns = params["columns"];
  if (!Array.isArray(columns)) return [];
  return columns.filter((item): item is string => typeof item === "string");
}

export function requesterLabel(
  membershipId: string | null | undefined,
  actorMembershipId: string,
  scheduleId: string | null | undefined,
): string {
  if (scheduleId) return "System";
  if (membershipId && membershipId === actorMembershipId) return "You";
  if (membershipId) return "Admin";
  return "System";
}

/** A cron expression for a cadence; weekly schedules run on `weeklyDay` (1 = Monday). */
export function cronFromCadence(
  cadence: "daily" | "weekly" | "monthly",
  time: string,
  weeklyDay = 1,
): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));
  if (cadence === "weekly") return `${String(minute)} ${String(hour)} * * ${String(weeklyDay)}`;
  if (cadence === "monthly") return `${String(minute)} ${String(hour)} 1 * *`;
  return `${String(minute)} ${String(hour)} * * *`;
}

/**
 * How a report words a schedule's cadence. The pages were written separately
 * and phrase it differently; each keeps its wording.
 */
export type CadenceWording = "comma" | "at" | "friday-weekly" | "ordinal-monthly";

export function cadenceLabel(cron: string, timezone: string, wording: CadenceWording): string {
  const parts = cron.trim().split(/\s+/);
  const minute = parts[0] ?? "0";
  const hour = parts[1] ?? "0";
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  const weekday = parts[4];
  const monthDay = parts[2];
  if (wording === "at") {
    if (weekday && weekday !== "*") return `Every Monday at ${time} ${timezone}`;
    if (monthDay && monthDay !== "*") return `1st of every month at ${time} ${timezone}`;
    return `Daily at ${time} ${timezone}`;
  }
  if (wording === "friday-weekly") {
    if (weekday === "5") return `Every Friday, ${time} ${timezone}`;
    if (weekday && weekday !== "*") return `Weekly (dow ${weekday}), ${time} ${timezone}`;
  } else if (weekday && weekday !== "*") {
    return `Every Monday, ${time} ${timezone}`;
  }
  if (monthDay && monthDay !== "*") {
    return wording === "ordinal-monthly"
      ? `On the ${monthDay} of each month, ${time} ${timezone}`
      : `Monthly on day ${monthDay}, ${time} ${timezone}`;
  }
  return `Daily, ${time} ${timezone}`;
}

/** How one report describes its export runs and schedules. */
export type ExportViewSpec<TDataset extends string> = {
  /** The run parameters that name the dataset, in the order they are read. */
  datasetParams: readonly string[];
  normalizeDataset: (value: unknown) => TDataset;
  datasetLabel: (dataset: TDataset) => string;
  fileNameFor: (dataset: TDataset, createdAt: string, format: string) => string;
  scopeLabel: (params: Record<string, unknown>) => string;
  errorMessageFor: (code: string | null) => string | null;
  /** History rows say who asked for the export (you, an admin, or a schedule). */
  requestedBy: boolean;
  /** History rows list the exported columns. */
  columns: boolean;
  /** Further report-specific history fields. */
  historyExtras?: (params: Record<string, unknown>) => Record<string, unknown>;
  defaultScheduleName: string;
  cadenceWording: CadenceWording;
  /** Schedule rows carry the dataset key as well as its label. */
  scheduleDataset: boolean;
  /** Schedule rows show a webhook label; null when the report's schedules have none. */
  webhookLabel: string | null;
};

function datasetOf<TDataset extends string>(
  spec: ExportViewSpec<TDataset>,
  params: Record<string, unknown>,
): TDataset {
  let value: unknown = undefined;
  for (const key of spec.datasetParams) {
    value ??= params[key];
  }
  return spec.normalizeDataset(value);
}

/** One export history row. */
export function describeExportRun<TDataset extends string>(
  spec: ExportViewSpec<TDataset>,
  run: ExportRun,
  actorMembershipId: string,
) {
  const dataset = datasetOf(spec, run.params);
  const expiresAt = run.expiresAt ?? run.download?.expiresAt ?? null;
  const expired = run.status === "SUCCEEDED" && isExpired(expiresAt);
  const errorMessage =
    typeof run.errorMessage === "string" && run.errorMessage.trim()
      ? run.errorMessage
      : spec.errorMessageFor(run.errorCode);
  return {
    id: run.id,
    fileName: spec.fileNameFor(dataset, run.createdAt, run.format),
    format: run.format as ExportFormat,
    dataset,
    datasetLabel: spec.datasetLabel(dataset),
    scopeLabel: spec.scopeLabel(run.params),
    rowCount: run.rowCount,
    sizeLabel: estimateSizeLabel(run.rowCount, run.format),
    ...(spec.requestedBy
      ? {
          requestedByLabel: requesterLabel(
            run.requestedByMembershipId,
            actorMembershipId,
            run.scheduleId,
          ),
        }
      : {}),
    status: run.status,
    expired,
    expiresAt,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    errorCode: run.errorCode,
    errorMessage,
    errorTrace: run.errorTrace ?? null,
    progressPercent: run.progressPercent ?? null,
    downloadAvailable: run.status === "SUCCEEDED" && !expired,
    ...(spec.columns ? { columns: columnsFromParams(run.params) } : {}),
    ...(spec.historyExtras ? spec.historyExtras(run.params) : {}),
  };
}

/** A schedule as the history and schedule views read it. */
export type ExportScheduleView = Omit<ExportSchedule, "definitionKey">;

function scheduleDelivery(schedule: ExportScheduleView) {
  const delivery = schedule.delivery ?? {};
  const recipients = Array.isArray(delivery["emails"])
    ? delivery["emails"].filter((item): item is string => typeof item === "string")
    : [];
  const webhookUrl = typeof delivery["webhookUrl"] === "string" ? delivery["webhookUrl"] : null;
  return { recipients, webhookUrl };
}

/** One export schedule row. */
export function describeExportSchedule<TDataset extends string>(
  spec: ExportViewSpec<TDataset>,
  schedule: ExportScheduleView,
) {
  const { recipients, webhookUrl } = scheduleDelivery(schedule);
  const dataset = datasetOf(spec, schedule.params);
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || spec.defaultScheduleName,
    ...(spec.scheduleDataset ? { dataset } : {}),
    datasetLabel: spec.datasetLabel(dataset),
    cadenceLabel: cadenceLabel(schedule.cronExpression, schedule.timezone, spec.cadenceWording),
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    formats: schedule.formats,
    isActive: schedule.isActive,
    nextRunAt: schedule.nextRunAt,
    nextRunLabel: nextRunLabel(schedule.nextRunAt),
    recipients,
    ...(spec.webhookLabel !== null ? { webhookLabel: webhookUrl ? spec.webhookLabel : null } : {}),
    delivery: schedule.delivery,
  };
}

/** A report's runs and its own schedules, for the exports page. */
export async function listExportLedger(tx: TenantTx, ctx: ServiceCtx, definitionKey: string) {
  const [runs, schedules] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey, limit: 50 }),
    listReportSchedules(tx, ctx),
  ]);
  return {
    runs: runs.data.items as ExportRun[],
    schedules: (schedules.data.items as ExportSchedule[]).filter(
      (item) => item.definitionKey === definitionKey,
    ),
  };
}

function exportNotFound(message: string) {
  return new AtlasHttpError({ code: "PERMISSION_DENIED", status: 404, message });
}

async function requireOwnSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  definitionKey: string,
  scheduleId: string,
): Promise<ExportSchedule> {
  const schedules = await listReportSchedules(tx, ctx);
  const existing = (schedules.data.items as ExportSchedule[]).find(
    (item) => item.id === scheduleId,
  );
  if (!existing || existing.definitionKey !== definitionKey) {
    throw exportNotFound("Schedule was not found.");
  }
  return existing;
}

type Parser<T> = { parse: (value: unknown) => T };

/**
 * The run and schedule operations every exports page has. `describeRun` and
 * `describeSchedule` turn reports.service rows into the report's history and
 * schedule items; each response schema is the report's own.
 */
export function createExportOperations<
  TRunDetail,
  TRetry,
  TUpdateBody extends Record<string, unknown>,
  TUpdate,
  TDelete,
>(config: {
  definitionKey: string;
  describeRun: (run: ExportRun, actorMembershipId: string) => unknown;
  describeSchedule: (schedule: ExportScheduleView) => unknown;
  /**
   * Whether a retry generates the file within the request. Reports whose routes
   * hand new runs to background processing after the response set this false.
   */
  retryProcessInline: boolean;
  schemas: {
    runDetail: Parser<TRunDetail>;
    retry: Parser<TRetry>;
    updateScheduleBody: Parser<TUpdateBody>;
    updateSchedule: Parser<TUpdate>;
    deleteSchedule: Parser<TDelete>;
  };
}) {
  const { definitionKey, describeRun, describeSchedule, retryProcessInline, schemas } = config;

  async function requireOwnRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
    const result = await getReportRun(tx, ctx, runId);
    if (result.data.definitionKey !== definitionKey) {
      throw exportNotFound("Export was not found.");
    }
    return result.data as ExportRun;
  }

  return {
    getRun: async (tx: TenantTx, ctx: ServiceCtx, runId: string): Promise<TRunDetail> => {
      const run = await requireOwnRun(tx, ctx, runId);
      return schemas.runDetail.parse({ data: describeRun(run, ctx.actorMembershipId) });
    },

    /**
     * Runs the same export again, in `options.format` when given; otherwise in
     * the original format, with a PDF export retried as CSV.
     */
    retry: async (
      tx: TenantTx,
      ctx: ServiceCtx,
      runId: string,
      options?: { format?: Exclude<ExportFormat, "pdf"> },
    ): Promise<TRetry> => {
      const existing = await requireOwnRun(tx, ctx, runId);
      const runResult = await createReportRun(
        tx,
        ctx,
        {
          definitionKey,
          format: options?.format ?? (existing.format === "pdf" ? "csv" : existing.format),
          params: existing.params,
        },
        { processInline: retryProcessInline },
      );
      return schemas.retry.parse({
        data: describeRun(runResult.data, ctx.actorMembershipId),
      });
    },

    updateSchedule: async (
      tx: TenantTx,
      ctx: ServiceCtx,
      scheduleId: string,
      input: unknown,
    ): Promise<TUpdate> => {
      const body = schemas.updateScheduleBody.parse(input);
      await requireOwnSchedule(tx, ctx, definitionKey, scheduleId);
      const updated = await updateReportSchedule(tx, ctx, scheduleId, body);
      return schemas.updateSchedule.parse({
        data: describeSchedule(updated.data),
      });
    },

    deleteSchedule: async (tx: TenantTx, ctx: ServiceCtx, scheduleId: string): Promise<TDelete> => {
      await requireOwnSchedule(tx, ctx, definitionKey, scheduleId);
      const deleted = await deleteReportSchedule(tx, ctx, scheduleId);
      return schemas.deleteSchedule.parse(deleted);
    },

    /**
     * Runs a schedule's export now, processed inline, and returns the run with
     * the schedule. The run records which schedule triggered it.
     */
    runScheduleNow: async <TRunNow>(
      tx: TenantTx,
      ctx: ServiceCtx,
      scheduleId: string,
      response: Parser<TRunNow>,
    ): Promise<TRunNow> => {
      const existing = await requireOwnSchedule(tx, ctx, definitionKey, scheduleId);
      const format = existing.formats[0] === "pdf" ? "csv" : (existing.formats[0] ?? "csv");
      const runResult = await createReportRun(
        tx,
        ctx,
        {
          definitionKey,
          format,
          params: { ...existing.params, triggeredFromScheduleId: existing.id },
        },
        { processInline: true },
      );
      return response.parse({
        data: {
          run: describeRun(runResult.data, ctx.actorMembershipId),
          schedule: describeSchedule(existing),
        },
      });
    },
  };
}
