import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  SM_AFFILIATE_EXPORT_COLUMNS,
  SM_AFFILIATE_PRODUCT_EXPORT_COLUMNS,
  SM_COUPON_EXPORT_COLUMNS,
  SM_EXPORT_DATASETS,
  SM_REFERRAL_EXPORT_COLUMNS,
  SM_SALES_EXPORT_COLUMNS,
  createSalesMarketingExportBodySchema,
  createSalesMarketingExportResponseSchema,
  deleteSalesMarketingExportScheduleResponseSchema,
  retrySalesMarketingExportResponseSchema,
  salesMarketingExportsResponseSchema,
  smExportRunDetailResponseSchema,
  updateSalesMarketingExportScheduleBodySchema,
  updateSalesMarketingExportScheduleResponseSchema,
  type CreateSalesMarketingExportBody,
} from "./sales-marketing-exports.dto";
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

const DEFINITION_KEY = "sales-marketing";

type SmExportDataset = (typeof SM_EXPORT_DATASETS)[number];

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

function datasetLabel(dataset: SmExportDataset): string {
  if (dataset === "coupons") return "Coupons";
  if (dataset === "referral-wallet") return "Referral & wallet";
  if (dataset === "affiliate-products") return "Affiliate products";
  if (dataset === "affiliates") return "Affiliates";
  return "Purchasers";
}

function normalizeDataset(value: unknown): SmExportDataset {
  if (
    typeof value === "string" &&
    (SM_EXPORT_DATASETS as readonly string[]).includes(value)
  ) {
    return value as SmExportDataset;
  }
  // Legacy runs used `section` without dataset alias
  if (typeof value === "string") {
    const asSection = value.trim();
    if ((SM_EXPORT_DATASETS as readonly string[]).includes(asSection)) {
      return asSection as SmExportDataset;
    }
  }
  return "sales";
}

function fileNameFor(dataset: SmExportDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const slug =
    dataset === "coupons"
      ? "coupons"
      : dataset === "referral-wallet"
        ? "referrals"
        : dataset === "affiliate-products"
          ? "affiliate-products"
          : dataset === "affiliates"
            ? "affiliates"
            : "sales";
  return `${slug}-${stamp}.${format === "json" ? "json" : format}`;
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
  if (typeof params["courseId"] === "string" && params["courseId"].trim()) {
    parts.push("1 product");
  } else {
    parts.push("All products");
  }
  if (typeof params["couponId"] === "string" && params["couponId"].trim()) {
    parts.push("1 coupon");
  }
  const from = formatDateShort(
    typeof params["purchasedFrom"] === "string" ? params["purchasedFrom"] : undefined,
  );
  const to = formatDateShort(
    typeof params["purchasedTo"] === "string" ? params["purchasedTo"] : undefined,
  );
  if (from && to) parts.push(`${from} – ${to}`);
  else if (from) parts.push(`from ${from}`);
  else if (to) parts.push(`until ${to}`);
  else parts.push("All time");
  return parts.join(" · ");
}

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  if (code === "REPORT_GENERATION_FAILED") {
    return "Export generation failed while building the artifact. Retry or narrow the scope.";
  }
  if (code === "REPORT_ROW_CAP_EXCEEDED") {
    return "The requested scope exceeded the export row cap. Narrow filters and retry.";
  }
  if (code === "REPORT_DEFINITION_NOT_FOUND") {
    return "Sales & Marketing report definition was not found.";
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
  if (parts[2] && parts[2] !== "*") return `On the ${parts[2]} of each month, ${time} ${timezone}`;
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

function allowedKeysFor(dataset: SmExportDataset): Set<string> {
  const catalog =
    dataset === "coupons"
      ? SM_COUPON_EXPORT_COLUMNS
      : dataset === "referral-wallet"
        ? SM_REFERRAL_EXPORT_COLUMNS
        : dataset === "affiliate-products"
          ? SM_AFFILIATE_PRODUCT_EXPORT_COLUMNS
          : dataset === "affiliates"
            ? SM_AFFILIATE_EXPORT_COLUMNS
            : SM_SALES_EXPORT_COLUMNS;
  return new Set(catalog.map((column) => column.key));
}

function sanitizeColumns(dataset: SmExportDataset, columns: string[]): string[] {
  const allowed = allowedKeysFor(dataset);
  const selected = columns.filter((column) => allowed.has(column));
  if (selected.length > 0) return selected;
  return [...allowed];
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
  const dataset = normalizeDataset(
    run.params["dataset"] ?? run.params["section"] ?? run.params["reportTab"],
  );
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
  const dataset = normalizeDataset(
    schedule.params["dataset"] ?? schedule.params["section"] ?? schedule.params["reportTab"],
  );
  return {
    id: schedule.id,
    name: schedule.name?.trim() || schedule.definitionTitle || "Sales & Marketing export",
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

function buildRunParams(body: CreateSalesMarketingExportBody): Record<string, unknown> {
  const params: Record<string, unknown> = {
    section: body.dataset,
    dataset: body.dataset,
    reportTab: body.dataset,
    columns: sanitizeColumns(body.dataset, body.columns),
    grouping: body.grouping,
    includeSubtotals: body.includeSubtotals,
  };
  if (body.courseId) params["courseId"] = body.courseId;
  if (body.couponId) params["couponId"] = body.couponId;
  if (body.purchasedFrom) params["purchasedFrom"] = body.purchasedFrom;
  if (body.purchasedTo) params["purchasedTo"] = body.purchasedTo;
  if (body.learnerName?.trim()) params["learnerName"] = body.learnerName.trim();
  if (body.email?.trim()) params["email"] = body.email.trim();
  if (body.q?.trim()) params["q"] = body.q.trim();
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

export async function getSalesMarketingExports(tx: TenantTx, ctx: ServiceCtx) {
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

  const smSchedules = schedules.data.items
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

  return salesMarketingExportsResponseSchema.parse({
    data: {
      history,
      schedules: smSchedules,
      columnsByDataset: {
        sales: SM_SALES_EXPORT_COLUMNS.map((column) => ({ ...column })),
        coupons: SM_COUPON_EXPORT_COLUMNS.map((column) => ({ ...column })),
        "referral-wallet": SM_REFERRAL_EXPORT_COLUMNS.map((column) => ({ ...column })),
        "affiliate-products": SM_AFFILIATE_PRODUCT_EXPORT_COLUMNS.map((column) => ({
          ...column,
        })),
        affiliates: SM_AFFILIATE_EXPORT_COLUMNS.map((column) => ({ ...column })),
      },
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...SM_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        note:
          "Exports generate from Sales & Marketing datasets (purchasers, coupons, referrals, affiliate products, and affiliates). Email and webhook delivery run after the artifact is ready. Ready files expire after the signed download TTL (typically 7 days).",
      },
    },
  });
}

export async function createSalesMarketingExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateSalesMarketingExportBody,
) {
  const body = createSalesMarketingExportBodySchema.parse(input);
  await ensureTenantReportDefinitions(tx);

  if (body.delivery === "recipients" && (!body.recipients || body.recipients.length === 0)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Add at least one recipient email for recipient delivery.",
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
    const timezone = body.timezone ?? "Asia/Kolkata";
    const scheduleResult = await createReportSchedule(tx, ctx, {
      definitionKey: DEFINITION_KEY,
      name:
        body.scheduleName?.trim() ||
        `Scheduled ${datasetLabel(body.dataset)} export`,
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

  return createSalesMarketingExportResponseSchema.parse({
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

export async function getSalesMarketingExportRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
) {
  const result = await getReportRun(tx, ctx, runId);
  if (result.data.definitionKey !== DEFINITION_KEY) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Export was not found.",
    });
  }
  return smExportRunDetailResponseSchema.parse({
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

export async function retrySalesMarketingExport(
  tx: TenantTx,
  ctx: ServiceCtx,
  runId: string,
) {
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

  return retrySalesMarketingExportResponseSchema.parse({
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

export async function updateSalesMarketingExportSchedule(
  tx: TenantTx,
  ctx: ServiceCtx,
  scheduleId: string,
  input: { isActive?: boolean; name?: string },
) {
  const body = updateSalesMarketingExportScheduleBodySchema.parse(input);
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
  return updateSalesMarketingExportScheduleResponseSchema.parse({
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

export async function deleteSalesMarketingExportSchedule(
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
  return deleteSalesMarketingExportScheduleResponseSchema.parse({
    data: { deleted: true as const, id: scheduleId },
  });
}
