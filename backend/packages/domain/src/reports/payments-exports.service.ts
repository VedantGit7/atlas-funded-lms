import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  PAYMENT_EXPORT_COLUMNS,
  PAYMENT_EXPORT_DATASETS,
  createPaymentExportBodySchema,
  createPaymentExportResponseSchema,
  deletePaymentExportScheduleResponseSchema,
  paymentExportRunDetailResponseSchema,
  paymentExportsResponseSchema,
  retryPaymentExportResponseSchema,
  updatePaymentExportScheduleBodySchema,
  updatePaymentExportScheduleResponseSchema,
  type CreatePaymentExportBody,
} from "./payments-exports.dto";
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

const DEFINITION_KEY = "payments";

type PaymentDataset = (typeof PAYMENT_EXPORT_DATASETS)[number];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function estimateSizeLabel(rowCount: number | null, format: string): string | null {
  if (rowCount == null || rowCount < 0) return null;
  const perRow = format === "xlsx" ? 120 : format === "json" ? 180 : 64;
  return `~${formatBytes(Math.max(rowCount, 1) * perRow)}`;
}

function datasetLabel(dataset: PaymentDataset): string {
  if (dataset === "gateways") return "Gateway transactions";
  if (dataset === "instalments") return "Instalments";
  if (dataset === "invoices") return "Invoices";
  if (dataset === "refunds") return "Refunds";
  return "Transactions";
}

function normalizeDataset(value: unknown): PaymentDataset {
  if (
    typeof value === "string" &&
    (PAYMENT_EXPORT_DATASETS as readonly string[]).includes(value)
  ) {
    return value as PaymentDataset;
  }
  return "transactions";
}

function fileNameFor(dataset: PaymentDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "export"
    : date.toISOString().slice(0, 10);
  const slug =
    dataset === "gateways"
      ? "gateway-txns"
      : dataset === "instalments"
        ? "instalments"
        : dataset === "invoices"
          ? "invoices"
          : dataset === "refunds"
            ? "refunds"
            : "transactions";
  return `payments_${slug}_${stamp}.${format === "json" ? "json" : format}`;
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
  const parts: string[] = [];
  const gatewayKey = params["gatewayKey"];
  if (typeof gatewayKey === "string" && gatewayKey.trim()) {
    parts.push(gatewayKey.trim());
  } else {
    parts.push("All sources");
  }
  const status = params["status"];
  if (typeof status === "string" && status.trim()) {
    parts.push(status.trim());
  }
  const from = formatDateShort(
    typeof params["startDate"] === "string"
      ? params["startDate"]
      : typeof params["paidFrom"] === "string"
        ? params["paidFrom"]
        : undefined,
  );
  const to = formatDateShort(
    typeof params["endDate"] === "string"
      ? params["endDate"]
      : typeof params["paidTo"] === "string"
        ? params["paidTo"]
        : undefined,
  );
  if (from && to) parts.push(`${from} – ${to}`);
  else if (from) parts.push(`From ${from}`);
  else if (to) parts.push(`Until ${to}`);
  else parts.push("All time");
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the payments artifact.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Payments report definition was not found.";
  }
  return code.replace(/_/g, " ").toLowerCase();
}

function cronFromCadence(cadence: "daily" | "weekly" | "monthly", time: string): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));
  if (cadence === "weekly") return `${minute} ${hour} * * 1`;
  if (cadence === "monthly") return `${minute} ${hour} 1 * *`;
  return `${minute} ${hour} * * *`;
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
  if (hours < 48) return `Next run in ${Math.max(1, hours)}h`;
  const days = Math.floor(hours / 24);
  return `Next run in ${days} day${days === 1 ? "" : "s"}`;
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

function mapHistoryItem(run: {
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
}) {
  const dataset = normalizeDataset(run.params["reportTab"]);
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
  const dataset = normalizeDataset(schedule.params["reportTab"]);
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || "Payment export",
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

function buildRunParams(body: CreatePaymentExportBody): Record<string, unknown> {
  const params: Record<string, unknown> = {
    reportTab: body.dataset === "gateways" ? "gateways" : body.dataset,
    columns: body.columns,
  };
  if (body.dataset === "instalments") {
    const instalmentKeys = new Set([
      "plan_id",
      "membership_id",
      "learner_name",
      "email",
      "product_title",
      "pricing_plan_label",
      "total_amount_cents",
      "remaining_amount_cents",
      "currency",
      "status",
      "created_at",
    ]);
    const remapped = body.columns
      .map((column) => {
        if (column === "amount_cents") return "total_amount_cents";
        if (column === "paid_at") return "created_at";
        if (column === "product_type") return "pricing_plan_label";
        return column;
      })
      .filter((column) => instalmentKeys.has(column));
    params["columns"] = remapped.length > 0 ? [...new Set(remapped)] : [...instalmentKeys];
  }
  if (body.paidFrom) params["startDate"] = body.paidFrom;
  if (body.paidTo) params["endDate"] = body.paidTo;
  if (body.gatewayKey?.trim()) params["gatewayKey"] = body.gatewayKey.trim();
  if (body.status?.trim()) params["status"] = body.status.trim();
  if (body.grouping !== "none") params["grouping"] = body.grouping;
  if (body.includeSubtotals) params["includeSubtotals"] = true;
  if (body.delivery !== "download") params["deliveryMode"] = body.delivery;
  if (body.recipients && body.recipients.length > 0) {
    params["deliveryEmails"] = body.recipients;
  }
  if (body.webhookUrl?.trim()) params["webhookUrl"] = body.webhookUrl.trim();
  return params;
}

export async function getPaymentExports(tx: TenantTx, ctx: ServiceCtx) {
  await ensureTenantReportDefinitions(tx);
  const [runs, schedules] = await Promise.all([
    listReportRuns(tx, ctx, { definitionKey: DEFINITION_KEY, limit: 50 }),
    listReportSchedules(tx, ctx),
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

  const paymentSchedules = schedules.data.items
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

  return paymentExportsResponseSchema.parse({
    data: {
      history,
      schedules: paymentSchedules,
      columns: PAYMENT_EXPORT_COLUMNS.map((column) => ({ ...column })),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...PAYMENT_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        groupingApplied: true,
        note:
          "Exports generate from the LMS payments ledger with optional grouping/subtotals. Email and webhook delivery run after the artifact is ready (email requires a configured notification provider). Ready files expire after the artifact TTL.",
      },
    },
  });
}

export async function createPaymentExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreatePaymentExportBody,
) {
  const body = createPaymentExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.dataset === "gateways" && !body.gatewayKey?.trim()) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Select a gateway for gateway transaction exports.",
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
    { processInline: false },
  );

  let schedule = null;
  if (body.scheduleEnabled) {
    const cadence = body.cadence ?? "monthly";
    const time = body.time ?? "06:00";
    const timezone = body.timezone ?? "UTC";
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

  return createPaymentExportResponseSchema.parse({
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

export async function getPaymentExportRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return paymentExportRunDetailResponseSchema.parse({
    data: mapHistoryItem({
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
    }),
  });
}

export async function retryPaymentExport(tx: TenantTx, ctx: ServiceCtx, runId: string) {
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
    { processInline: false },
  );

  return retryPaymentExportResponseSchema.parse({
    data: mapHistoryItem({
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
  });
}

export async function updatePaymentExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean; name?: string },
) {
  const body = updatePaymentExportScheduleBodySchema.parse(input);
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
  return updatePaymentExportScheduleResponseSchema.parse({
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

export async function deletePaymentExportSchedule(
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
  const deleted = await deleteReportSchedule(tx, ctx, scheduleId);
  return deletePaymentExportScheduleResponseSchema.parse(deleted);
}
