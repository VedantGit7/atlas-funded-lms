import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import {
  REPORT_EXPORT_CADENCE,
  REPORT_EXPORT_FORMATS,
  exportDatasetFields,
  exportRunFileFields,
  exportRunScopeFields,
  exportRunStateFields,
  exportScheduleDeliveryField,
  exportScheduleTimingFields,
  reportExportResponseSchemas,
} from "./report-exports.dto";

export const PAYMENT_EXPORT_DATASETS = [
  "transactions",
  /**
   * The order ledger, which is not the same view of `payment_orders` as
   * `transactions`.
   *
   * Transactions are ordered and date-filtered by settlement date, so an order
   * that never settled sorts by the day it was created and reads as though it
   * settled then. The orders view sorts and filters by creation date, exposes
   * the external id a webhook matches on, and can be narrowed to settled or
   * unsettled rows — the three things an operator reconciling stuck orders
   * needs, and none of which the transactions view can express.
   */
  "orders",
  "invoices",
  "instalments",
  "refunds",
  "gateways",
] as const;

/** Whether an order carries a settlement timestamp. Only meaningful for `orders`. */
export const PAYMENT_EXPORT_SETTLEMENTS = ["settled", "unsettled"] as const;

export const PAYMENT_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const PAYMENT_EXPORT_GROUPING = ["none", "gateway", "product", "currency", "month"] as const;

export const PAYMENT_EXPORT_COLUMNS = [
  { key: "id", label: "Order ID", sensitive: false, defaultSelected: false },
  /**
   * Queried by every payments dataset and, until now, selectable by none of
   * them — which made the shared export useless for the one job an external id
   * exists for: matching a row against what the gateway thinks it settled.
   */
  { key: "external_id", label: "External ID", sensitive: false, defaultSelected: false },
  { key: "learner_name", label: "Learner name", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: false, defaultSelected: true },
  { key: "product_title", label: "Product", sensitive: false, defaultSelected: true },
  { key: "product_type", label: "Product type", sensitive: false, defaultSelected: false },
  { key: "gateway_key", label: "Gateway", sensitive: false, defaultSelected: true },
  { key: "coupon_amount_cents", label: "Coupon amount", sensitive: true, defaultSelected: false },
  { key: "amount_cents", label: "Amount", sensitive: true, defaultSelected: true },
  { key: "tax_amount_cents", label: "Tax", sensitive: true, defaultSelected: false },
  { key: "currency", label: "Currency", sensitive: false, defaultSelected: true },
  { key: "status", label: "Status", sensitive: false, defaultSelected: true },
  { key: "invoice_number", label: "Invoice number", sensitive: false, defaultSelected: false },
  { key: "paid_at", label: "Transaction date", sensitive: false, defaultSelected: true },
  { key: "created_at", label: "Created date", sensitive: false, defaultSelected: false },
] as const;

export const paymentExportColumnKeySchema = z.enum([
  "id",
  "external_id",
  "learner_name",
  "email",
  "product_title",
  "product_type",
  "gateway_key",
  "coupon_amount_cents",
  "amount_cents",
  "tax_amount_cents",
  "currency",
  "status",
  "invoice_number",
  "paid_at",
  "created_at",
]);

export const paymentExportHistoryItemSchema = z
  .object({
    ...exportRunFileFields,
    ...exportDatasetFields(PAYMENT_EXPORT_DATASETS),
    ...exportRunScopeFields,
    ...exportRunStateFields,
    columns: z.array(z.string()),
  })
  .strict();

export const paymentExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    datasetLabel: z.string(),
    ...exportScheduleTimingFields,
    webhookLabel: z.string().nullable(),
    ...exportScheduleDeliveryField,
  })
  .strict();

export const paymentExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(paymentExportHistoryItemSchema),
    schedules: z.array(paymentExportScheduleItemSchema),
    columns: z.array(
      z
        .object({
          key: paymentExportColumnKeySchema,
          label: z.string(),
          sensitive: z.boolean(),
          defaultSelected: z.boolean(),
        })
        .strict(),
    ),
    capabilities: z.object({
      formats: z.array(z.enum(REPORT_EXPORT_FORMATS)),
      datasets: z.array(z.enum(PAYMENT_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      groupingApplied: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createPaymentExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(PAYMENT_EXPORT_DATASETS).default("transactions"),
    columns: z.array(paymentExportColumnKeySchema).min(1).max(20),
    format: z.enum(REPORT_EXPORT_FORMATS).default("csv"),
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    gatewayKey: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    settlement: z.enum(PAYMENT_EXPORT_SETTLEMENTS).optional(),
    useCurrentFilters: z.boolean().default(true),
    grouping: z.enum(PAYMENT_EXPORT_GROUPING).default("none"),
    includeSubtotals: z.boolean().default(false),
    delivery: z.enum(PAYMENT_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.email()).max(20).optional(),
    webhookUrl: z.url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(REPORT_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreatePaymentExportBody = z.output<typeof createPaymentExportBodySchema>;

const exportResponses = reportExportResponseSchemas(
  paymentExportHistoryItemSchema,
  paymentExportScheduleItemSchema,
);

export const createPaymentExportResponseSchema = exportResponses.create;
export const paymentExportRunDetailResponseSchema = exportResponses.runDetail;
export const retryPaymentExportResponseSchema = exportResponses.retry;
export const updatePaymentExportScheduleResponseSchema = exportResponses.updateSchedule;
