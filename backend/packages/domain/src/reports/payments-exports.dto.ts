import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const PAYMENT_EXPORT_DATASETS = [
  "transactions",
  "invoices",
  "instalments",
  "refunds",
  "gateways",
] as const;

export const PAYMENT_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const PAYMENT_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const PAYMENT_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const PAYMENT_EXPORT_GROUPING = ["none", "gateway", "product", "currency", "month"] as const;

export const PAYMENT_EXPORT_COLUMNS = [
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
    id: z.uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(PAYMENT_EXPORT_DATASETS),
    datasetLabel: z.string(),
    scopeLabel: z.string(),
    rowCount: z.number().int().nullable(),
    sizeLabel: z.string().nullable(),
    status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    expired: z.boolean(),
    expiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorTrace: z.array(z.string()).nullable(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    downloadAvailable: z.boolean(),
    columns: z.array(z.string()),
  })
  .strict();

export const paymentExportScheduleItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    datasetLabel: z.string(),
    cadenceLabel: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    formats: z.array(z.enum(REPORT_FORMATS)),
    isActive: z.boolean(),
    nextRunAt: z.iso.datetime(),
    nextRunLabel: z.string(),
    recipients: z.array(z.string()),
    webhookLabel: z.string().nullable(),
    delivery: z.record(z.string(), z.unknown()).nullable(),
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
      formats: z.array(z.enum(PAYMENT_EXPORT_FORMATS)),
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
    format: z.enum(PAYMENT_EXPORT_FORMATS).default("csv"),
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    gatewayKey: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    useCurrentFilters: z.boolean().default(true),
    grouping: z.enum(PAYMENT_EXPORT_GROUPING).default("none"),
    includeSubtotals: z.boolean().default(false),
    delivery: z.enum(PAYMENT_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.email()).max(20).optional(),
    webhookUrl: z.url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(PAYMENT_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreatePaymentExportBody = z.output<typeof createPaymentExportBodySchema>;

export const createPaymentExportResponseSchema = z.object({
  data: z.object({
    run: paymentExportHistoryItemSchema,
    schedule: paymentExportScheduleItemSchema.nullable(),
  }),
});

export const paymentExportRunParamsSchema = z
  .object({
    runId: z.uuid(),
  })
  .strict();

export const paymentExportRunDetailResponseSchema = z.object({
  data: paymentExportHistoryItemSchema,
});

export const retryPaymentExportResponseSchema = z.object({
  data: paymentExportHistoryItemSchema,
});

export const paymentExportScheduleParamsSchema = z
  .object({
    scheduleId: z.uuid(),
  })
  .strict();

export const updatePaymentExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updatePaymentExportScheduleResponseSchema = z.object({
  data: paymentExportScheduleItemSchema,
});

export const deletePaymentExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.uuid(),
  }),
});
