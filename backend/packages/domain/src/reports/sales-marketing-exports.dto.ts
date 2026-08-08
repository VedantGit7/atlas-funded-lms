import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { REPORT_FORMATS } from "./reports.contract";

export const SM_EXPORT_DATASETS = [
  "sales",
  "coupons",
  "referral-wallet",
  "affiliate-products",
  "affiliates",
] as const;

export const SM_EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const SM_EXPORT_DELIVERY = ["download", "email_me", "recipients"] as const;
export const SM_EXPORT_CADENCE = ["daily", "weekly", "monthly"] as const;
export const SM_EXPORT_GROUPING = ["none", "product", "month", "currency"] as const;

export const SM_SALES_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner name", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "product_title", label: "Product", sensitive: false, defaultSelected: true },
  { key: "amount_cents", label: "Amount", sensitive: false, defaultSelected: true },
  { key: "currency", label: "Currency", sensitive: false, defaultSelected: true },
  { key: "enrolled_type", label: "Type", sensitive: false, defaultSelected: true },
  { key: "purchased_at", label: "Purchased on", sensitive: false, defaultSelected: true },
  { key: "course_id", label: "Course ID", sensitive: false, defaultSelected: false },
  { key: "membership_id", label: "Membership ID", sensitive: false, defaultSelected: false },
] as const;

export const SM_COUPON_EXPORT_COLUMNS = [
  { key: "code", label: "Code", sensitive: false, defaultSelected: true },
  { key: "name", label: "Name", sensitive: false, defaultSelected: true },
  { key: "status", label: "Status", sensitive: false, defaultSelected: true },
  { key: "discount_type", label: "Discount type", sensitive: false, defaultSelected: true },
  { key: "discount_value", label: "Discount value", sensitive: false, defaultSelected: true },
  { key: "currency", label: "Currency", sensitive: false, defaultSelected: false },
  { key: "redemption_count", label: "Redemptions", sensitive: false, defaultSelected: true },
  { key: "total_discount_cents", label: "Total discount", sensitive: false, defaultSelected: true },
  { key: "total_revenue_cents", label: "Total revenue", sensitive: false, defaultSelected: true },
  { key: "coupon_id", label: "Coupon ID", sensitive: false, defaultSelected: false },
] as const;

export const SM_REFERRAL_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Learner name", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "referral_code", label: "Referral code", sensitive: false, defaultSelected: true },
  { key: "successful_referrals", label: "Successful referrals", sensitive: false, defaultSelected: true },
  { key: "credit_earned", label: "Credit earned", sensitive: false, defaultSelected: true },
  { key: "wallet_balance", label: "Wallet balance", sensitive: false, defaultSelected: true },
  { key: "membership_id", label: "Membership ID", sensitive: false, defaultSelected: false },
] as const;

export const SM_AFFILIATE_PRODUCT_EXPORT_COLUMNS = [
  { key: "product_title", label: "Product", sensitive: false, defaultSelected: true },
  { key: "enabled", label: "Enabled", sensitive: false, defaultSelected: true },
  { key: "order_count", label: "Orders", sensitive: false, defaultSelected: true },
  { key: "revenue_cents", label: "Revenue", sensitive: false, defaultSelected: true },
  { key: "commission_cents", label: "Commission", sensitive: false, defaultSelected: true },
  { key: "published_at", label: "Published", sensitive: false, defaultSelected: false },
  { key: "course_id", label: "Course ID", sensitive: false, defaultSelected: false },
] as const;

export const SM_AFFILIATE_EXPORT_COLUMNS = [
  { key: "learner_name", label: "Affiliate name", sensitive: false, defaultSelected: true },
  { key: "email", label: "Email", sensitive: true, defaultSelected: true },
  { key: "tier", label: "Tier", sensitive: false, defaultSelected: true },
  { key: "status", label: "Status", sensitive: false, defaultSelected: true },
  { key: "coupon_code", label: "Coupon code", sensitive: false, defaultSelected: true },
  { key: "revenue_contribution_cents", label: "Revenue contribution", sensitive: false, defaultSelected: true },
  { key: "commission_earned_cents", label: "Commission earned", sensitive: false, defaultSelected: true },
  { key: "signed_up_at", label: "Signed up", sensitive: false, defaultSelected: true },
  { key: "affiliate_id", label: "Affiliate ID", sensitive: false, defaultSelected: false },
  { key: "membership_id", label: "Membership ID", sensitive: false, defaultSelected: false },
] as const;

export const smExportColumnKeySchema = z.string().min(1).max(64);

export const smExportHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fileName: z.string(),
    format: z.enum(REPORT_FORMATS),
    dataset: z.enum(SM_EXPORT_DATASETS),
    datasetLabel: z.string(),
    scopeLabel: z.string(),
    rowCount: z.number().int().nullable(),
    sizeLabel: z.string().nullable(),
    requestedByLabel: z.string(),
    status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    expired: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorTrace: z.array(z.string()).nullable(),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    downloadAvailable: z.boolean(),
    columns: z.array(z.string()),
  })
  .strict();

export const smExportScheduleItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    datasetLabel: z.string(),
    cadenceLabel: z.string(),
    cronExpression: z.string(),
    timezone: z.string(),
    formats: z.array(z.enum(REPORT_FORMATS)),
    isActive: z.boolean(),
    nextRunAt: z.string().datetime(),
    nextRunLabel: z.string(),
    recipients: z.array(z.string()),
    webhookLabel: z.string().nullable(),
    delivery: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export const smExportColumnSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    sensitive: z.boolean(),
    defaultSelected: z.boolean(),
  })
  .strict();

export const salesMarketingExportsResponseSchema = z.object({
  data: z.object({
    history: z.array(smExportHistoryItemSchema),
    schedules: z.array(smExportScheduleItemSchema),
    columnsByDataset: z.object({
      sales: z.array(smExportColumnSchema),
      coupons: z.array(smExportColumnSchema),
      "referral-wallet": z.array(smExportColumnSchema),
      "affiliate-products": z.array(smExportColumnSchema),
      affiliates: z.array(smExportColumnSchema),
    }),
    capabilities: z.object({
      formats: z.array(z.enum(SM_EXPORT_FORMATS)),
      datasets: z.array(z.enum(SM_EXPORT_DATASETS)),
      canSchedule: z.boolean(),
      canEmailDelivery: z.boolean(),
      canWebhookDelivery: z.boolean(),
      note: z.string(),
    }),
  }),
});

export const createSalesMarketingExportBodySchema = rejectClientTenantFields
  .extend({
    dataset: z.enum(SM_EXPORT_DATASETS).default("sales"),
    columns: z.array(smExportColumnKeySchema).min(1).max(30),
    format: z.enum(SM_EXPORT_FORMATS).default("csv"),
    courseId: z.string().uuid().optional(),
    couponId: z.string().uuid().optional(),
    purchasedFrom: z.string().datetime().optional(),
    purchasedTo: z.string().datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    grouping: z.enum(SM_EXPORT_GROUPING).default("none"),
    includeSubtotals: z.boolean().default(false),
    useCurrentFilters: z.boolean().default(true),
    filterSummary: z.string().trim().max(500).optional(),
    delivery: z.enum(SM_EXPORT_DELIVERY).default("download"),
    recipients: z.array(z.string().email()).max(20).optional(),
    webhookUrl: z.string().url().max(500).nullable().optional(),
    scheduleEnabled: z.boolean().default(false),
    scheduleName: z.string().trim().max(120).optional(),
    cadence: z.enum(SM_EXPORT_CADENCE).optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateSalesMarketingExportBody = z.output<
  typeof createSalesMarketingExportBodySchema
>;

export const createSalesMarketingExportResponseSchema = z.object({
  data: z.object({
    run: smExportHistoryItemSchema,
    schedule: smExportScheduleItemSchema.nullable(),
  }),
});

export const smExportRunParamsSchema = z
  .object({
    runId: z.string().uuid(),
  })
  .strict();

export const smExportRunDetailResponseSchema = z.object({
  data: smExportHistoryItemSchema,
});

export const retrySalesMarketingExportResponseSchema = z.object({
  data: smExportHistoryItemSchema,
});

export const smExportScheduleParamsSchema = z
  .object({
    scheduleId: z.string().uuid(),
  })
  .strict();

export const updateSalesMarketingExportScheduleBodySchema = rejectClientTenantFields
  .extend({
    isActive: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateSalesMarketingExportScheduleResponseSchema = z.object({
  data: smExportScheduleItemSchema,
});

export const deleteSalesMarketingExportScheduleResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
  }),
});
