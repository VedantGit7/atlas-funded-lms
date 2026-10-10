import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  SM_AFFILIATE_EXPORT_COLUMNS,
  SM_ATTRIBUTION_EXPORT_COLUMNS,
  SM_AFFILIATE_PRODUCT_EXPORT_COLUMNS,
  SM_COUPON_EXPORT_COLUMNS,
  SM_EXPORT_DATASETS,
  SM_REFERRAL_EXPORT_COLUMNS,
  SM_SALES_EXPORT_COLUMNS,
  createSalesMarketingExportBodySchema,
  createSalesMarketingExportResponseSchema,
  retrySalesMarketingExportResponseSchema,
  salesMarketingExportsResponseSchema,
  smExportRunDetailResponseSchema,
  updateSalesMarketingExportScheduleResponseSchema,
  type CreateSalesMarketingExportBody,
} from "./sales-marketing-exports.dto";
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
import {
  deleteReportExportScheduleResponseSchema,
  updateReportExportScheduleBodySchema,
} from "./report-exports.dto";

const DEFINITION_KEY = "sales-marketing";

type SmExportDataset = (typeof SM_EXPORT_DATASETS)[number];

function datasetLabel(dataset: SmExportDataset): string {
  if (dataset === "coupons") return "Coupons";
  if (dataset === "attribution") return "Attribution events";
  if (dataset === "referral-wallet") return "Referral & wallet";
  if (dataset === "affiliate-products") return "Affiliate products";
  if (dataset === "affiliates") return "Affiliates";
  return "Purchasers";
}

function normalizeDataset(value: unknown): SmExportDataset {
  if (typeof value === "string" && (SM_EXPORT_DATASETS as readonly string[]).includes(value)) {
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
    dataset === "attribution"
      ? "attribution-events"
      : dataset === "coupons"
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
  // A presence narrowing changes the row count dramatically, so a history entry
  // that does not name it describes a file nobody can reproduce.
  const attribution = params["attribution"];
  if (attribution === "attributed" || attribution === "none") {
    parts.push(attribution === "attributed" ? "With UTM" : "No UTM");
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

const view: ExportViewSpec<SmExportDataset> = {
  datasetParams: ["dataset", "section", "reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: true,
  columns: true,
  defaultScheduleName: "Sales & Marketing export",
  cadenceWording: "ordinal-monthly",
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
  retryProcessInline: false,
  schemas: {
    runDetail: smExportRunDetailResponseSchema,
    retry: retrySalesMarketingExportResponseSchema,
    updateScheduleBody: updateReportExportScheduleBodySchema,
    updateSchedule: updateSalesMarketingExportScheduleResponseSchema,
    deleteSchedule: deleteReportExportScheduleResponseSchema,
  },
});

function allowedKeysFor(dataset: SmExportDataset): Set<string> {
  const catalog =
    dataset === "attribution"
      ? SM_ATTRIBUTION_EXPORT_COLUMNS
      : dataset === "coupons"
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
  if (body.attribution) params["attribution"] = body.attribution;
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
        attribution: SM_ATTRIBUTION_EXPORT_COLUMNS.map((column) => ({ ...column })),
      },
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...SM_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        note: "Exports generate from Sales & Marketing datasets (purchasers, coupons, referrals, affiliate products, and affiliates). Email and webhook delivery run after the artifact is ready. Ready files expire after the signed download TTL (typically 7 days).",
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

  // Silently dropping a filter produces a file that looks like the filtered
  // one and is not, which is worse than refusing the request.
  if (body.attribution && body.dataset !== "attribution") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Attribution filtering applies to the attribution dataset only.",
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
      name: body.scheduleName?.trim() || `Scheduled ${datasetLabel(body.dataset)} export`,
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

export const getSalesMarketingExportRun = operations.getRun;
export const retrySalesMarketingExport = operations.retry;
export const updateSalesMarketingExportSchedule = operations.updateSchedule;
export const deleteSalesMarketingExportSchedule = operations.deleteSchedule;
