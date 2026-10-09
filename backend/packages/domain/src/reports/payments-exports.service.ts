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
  ensureTenantReportDefinitions,
} from "./reports.service";
import {
  createExportOperations,
  cronFromCadence,
  describeExportRun,
  describeExportSchedule,
  formatDateShort,
  listExportLedger,
  type ExportRun,
  type ExportScheduleView,
  type ExportViewSpec,
} from "./report-exports.kit";

const DEFINITION_KEY = "payments";

type PaymentDataset = (typeof PAYMENT_EXPORT_DATASETS)[number];

function datasetLabel(dataset: PaymentDataset): string {
  if (dataset === "gateways") return "Gateway transactions";
  if (dataset === "orders") return "Orders";
  if (dataset === "instalments") return "Instalments";
  if (dataset === "invoices") return "Invoices";
  if (dataset === "refunds") return "Refunds";
  return "Transactions";
}

function normalizeDataset(value: unknown): PaymentDataset {
  if (typeof value === "string" && (PAYMENT_EXPORT_DATASETS as readonly string[]).includes(value)) {
    return value as PaymentDataset;
  }
  return "transactions";
}

function fileNameFor(dataset: PaymentDataset, createdAt: string, format: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime()) ? "export" : date.toISOString().slice(0, 10);
  const slug =
    dataset === "gateways"
      ? "gateway-txns"
      : dataset === "orders"
        ? "orders"
        : dataset === "instalments"
          ? "instalments"
          : dataset === "invoices"
            ? "invoices"
            : dataset === "refunds"
              ? "refunds"
              : "transactions";
  return `payments_${slug}_${stamp}.${format === "json" ? "json" : format}`;
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
  // A settlement narrowing halves the row count, so a history entry that does
  // not name it describes a file nobody can reproduce.
  const settlement = params["settlement"];
  if (settlement === "settled" || settlement === "unsettled") {
    parts.push(settlement === "settled" ? "Settled only" : "Unsettled only");
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

const view: ExportViewSpec<PaymentDataset> = {
  datasetParams: ["reportTab"],
  normalizeDataset,
  datasetLabel,
  fileNameFor,
  scopeLabel: scopeLabelFromParams,
  errorMessageFor,
  requestedBy: false,
  columns: true,
  defaultScheduleName: "Payment export",
  cadenceWording: "comma",
  scheduleDataset: false,
  webhookLabel: "webhook",
};

const describeRun = (run: ExportRun, actorMembershipId: string) =>
  describeExportRun(view, run, actorMembershipId);
const describeSchedule = (schedule: ExportScheduleView) => describeExportSchedule(view, schedule);

const operations = createExportOperations({
  definitionKey: DEFINITION_KEY,
  describeRun,
  describeSchedule,
  retryProcessInline: false,
  schemas: {
    runDetail: paymentExportRunDetailResponseSchema,
    retry: retryPaymentExportResponseSchema,
    updateScheduleBody: updatePaymentExportScheduleBodySchema,
    updateSchedule: updatePaymentExportScheduleResponseSchema,
    deleteSchedule: deletePaymentExportScheduleResponseSchema,
  },
});

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
  if (body.settlement) params["settlement"] = body.settlement;
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
  const { runs, schedules } = await listExportLedger(tx, ctx, DEFINITION_KEY);
  return paymentExportsResponseSchema.parse({
    data: {
      history: runs.map((run) => describeRun(run, ctx.actorMembershipId)),
      schedules: schedules.map(describeSchedule),
      columns: PAYMENT_EXPORT_COLUMNS.map((column) => ({ ...column })),
      capabilities: {
        formats: ["csv", "xlsx", "json"],
        datasets: [...PAYMENT_EXPORT_DATASETS],
        canSchedule: true,
        canEmailDelivery: true,
        canWebhookDelivery: true,
        groupingApplied: true,
        note: "Exports generate from the LMS payments ledger with optional grouping/subtotals. Email and webhook delivery run after the artifact is ready (email requires a configured notification provider). Ready files expire after the artifact TTL.",
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

  // Silently dropping a filter on a finance export is how a partial file gets
  // reconciled as though it were complete, so an unusable one is refused.
  if (body.settlement && body.dataset !== "orders") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Settlement filtering applies to the orders dataset only.",
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
    schedule = describeSchedule(scheduleResult.data);
  }

  return createPaymentExportResponseSchema.parse({
    data: {
      run: describeRun(runResult.data, ctx.actorMembershipId),
      schedule,
    },
  });
}

export const getPaymentExportRun = operations.getRun;
export const retryPaymentExport = operations.retry;
export const updatePaymentExportSchedule = operations.updateSchedule;
export const deletePaymentExportSchedule = operations.deleteSchedule;
