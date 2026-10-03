import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const PAYMENT_ROSTER_COLUMNS = [
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
] as const;

export type PaymentRosterColumn = (typeof PAYMENT_ROSTER_COLUMNS)[number];

export const PAYMENT_INVOICE_COLUMNS = [
  "invoice_number",
  "learner_name",
  "email",
  "billing_name",
  "product_title",
  "amount_cents",
  "tax_amount_cents",
  "currency",
  "paid_at",
] as const;

export type PaymentInvoiceColumn = (typeof PAYMENT_INVOICE_COLUMNS)[number];

export const PAYMENT_INSTALMENT_COLUMNS = [
  "learner_name",
  "email",
  "product_title",
  "pricing_plan_label",
  "total_amount_cents",
  "remaining_amount_cents",
  "currency",
  "status",
  "created_at",
  "next_due_at",
] as const;

export type PaymentInstalmentColumn = (typeof PAYMENT_INSTALMENT_COLUMNS)[number];

function parseColumns(allowed: readonly string[], value: unknown): string[] {
  const allowedSet = new Set<string>(allowed);
  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && allowedSet.has(column),
    );
    return selected.length > 0 ? selected : [...allowed];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...allowed];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter((column) => allowedSet.has(column));
  return selected.length > 0 ? selected : [...allowed];
}

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const paymentTransactionsQuerySchema = rejectClientTenantFields
  .extend({
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    productType: z.string().trim().min(1).max(64).optional(),
    gatewayKey: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    amountMinCents: z.coerce.number().int().min(0).optional(),
    dateField: z.enum(["paid_at", "created_at"]).default("paid_at"),
    sortBy: z
      .enum(["paid_at", "created_at", "coupon_amount_cents", "amount_cents"])
      .default("paid_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(PAYMENT_ROSTER_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PaymentTransactionsQuery = z.output<typeof paymentTransactionsQuerySchema>;

export const paymentTransactionItemSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid().nullable(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    productTitle: z.string().nullable(),
    productType: z.string().nullable(),
    gatewayKey: z.string().nullable(),
    couponAmountCents: z.number().int().nullable(),
    amountCents: z.number().int(),
    taxAmountCents: z.number().int().nullable(),
    currency: z.string(),
    status: z.string(),
    invoiceNumber: z.string().nullable(),
    externalId: z.string().nullable(),
    paidAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const paymentTransactionsListResponseSchema = z.object({
  data: z.object({
    items: z.array(paymentTransactionItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    totals: z.object({
      pageAmountCents: z.number().int().nonnegative(),
      filteredAmountCents: z.number().int().nonnegative(),
      currency: z.string(),
    }),
  }),
});

export const paymentGatewaysQuerySchema = rejectClientTenantFields
  .extend({
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
  })
  .strict();

export type PaymentGatewaysQuery = z.output<typeof paymentGatewaysQuerySchema>;

export const paymentGatewaysListResponseSchema = z.object({
  data: z.object({
    summary: z.object({
      totalPaidCents: z.number().int().nonnegative(),
      currency: z.string(),
      windowFrom: z.iso.datetime(),
      windowTo: z.iso.datetime(),
      windowLabel: z.string(),
    }),
    items: z.array(
      z
        .object({
          id: z.uuid(),
          gatewayKey: z.string(),
          displayName: z.string(),
          isConfigured: z.boolean(),
          isPublished: z.boolean(),
          isDefault: z.boolean(),
          transactionCount: z.number().int().nonnegative(),
          paidTransactionCount: z.number().int().nonnegative(),
          failedCount: z.number().int().nonnegative(),
          paidAmountCents: z.number().int().nonnegative(),
          successPercent: z.number().nonnegative().nullable(),
          volumeSharePercent: z.number().nonnegative(),
          currency: z.string(),
        })
        .strict(),
    ),
  }),
});

export const paymentGatewayKeyParamsSchema = z
  .object({
    gatewayKey: z.string().trim().min(1).max(64),
  })
  .strict();

export const paymentGatewayDetailQuerySchema = rejectClientTenantFields
  .extend({
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
  })
  .strict();

export type PaymentGatewayDetailQuery = z.output<typeof paymentGatewayDetailQuerySchema>;

export const paymentGatewayDetailResponseSchema = z.object({
  data: z.object({
    gateway: z
      .object({
        id: z.uuid(),
        gatewayKey: z.string(),
        displayName: z.string(),
        isConfigured: z.boolean(),
        isPublished: z.boolean(),
        isDefault: z.boolean(),
        publishableKeyMasked: z.string().nullable(),
        secretLast4: z.string().nullable(),
        hasSecret: z.boolean(),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
      })
      .strict(),
    summary: z
      .object({
        paidAmountCents: z.number().int().nonnegative(),
        previousPaidAmountCents: z.number().int().nonnegative(),
        changePercent: z.number().nullable(),
        transactionCount: z.number().int().nonnegative(),
        paidTransactionCount: z.number().int().nonnegative(),
        failedCount: z.number().int().nonnegative(),
        refundedCount: z.number().int().nonnegative(),
        successPercent: z.number().nonnegative().nullable(),
        currency: z.string(),
        windowFrom: z.iso.datetime(),
        windowTo: z.iso.datetime(),
        windowLabel: z.string(),
      })
      .strict(),
    capabilities: z
      .object({
        feesTracked: z.boolean(),
        payoutsAvailable: z.boolean(),
        webhookLogAvailable: z.boolean(),
      })
      .strict(),
  }),
});

export const paymentInvoicesQuerySchema = rejectClientTenantFields
  .extend({
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    sortBy: z.enum(["paid_at", "invoice_number", "amount_cents"]).default("paid_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(PAYMENT_INVOICE_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PaymentInvoicesQuery = z.output<typeof paymentInvoicesQuerySchema>;

export const paymentInvoiceItemSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid().nullable(),
    invoiceNumber: z.string(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    billingName: z.string().nullable(),
    billingNameDiffers: z.boolean(),
    productTitle: z.string().nullable(),
    amountCents: z.number().int(),
    taxAmountCents: z.number().int().nullable(),
    currency: z.string(),
    paidAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    status: z.enum(["issued", "void"]),
    voidedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const paymentInvoicesListResponseSchema = z.object({
  data: z.object({
    items: z.array(paymentInvoiceItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    totals: z.object({
      pageByCurrency: z.array(
        z.object({
          currency: z.string(),
          amountCents: z.number().int().nonnegative(),
        }),
      ),
      filteredByCurrency: z.array(
        z.object({
          currency: z.string(),
          amountCents: z.number().int().nonnegative(),
        }),
      ),
    }),
  }),
});

export const paymentInvoiceDetailParamsSchema = z
  .object({
    orderId: z.uuid(),
  })
  .strict();

export const PAYMENT_INVOICE_VOID_REASONS = [
  "issued_in_error",
  "duplicate",
  "amount_incorrect",
  "order_refunded",
] as const;

export type PaymentInvoiceVoidReason = (typeof PAYMENT_INVOICE_VOID_REASONS)[number];

export const paymentInvoiceDetailResponseSchema = z.object({
  data: z.object({
    orderId: z.uuid(),
    displayId: z.string(),
    membershipId: z.uuid().nullable(),
    invoiceNumber: z.string(),
    status: z.enum(["issued", "void"]),
    orderStatus: z.string(),
    businessName: z.string().nullable(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    billingName: z.string().nullable(),
    billingNameDiffers: z.boolean(),
    productTitle: z.string().nullable(),
    gatewayKey: z.string().nullable(),
    amountCents: z.number().int(),
    subtotalCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
    taxAmountCents: z.number().int().nullable(),
    taxPercent: z.number().nullable(),
    amountPaidCents: z.number().int().nonnegative(),
    balanceDueCents: z.number().int().nonnegative(),
    currency: z.string(),
    paidAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    issuedAt: z.iso.datetime().nullable(),
    voidedAt: z.iso.datetime().nullable(),
    voidReason: z.enum(PAYMENT_INVOICE_VOID_REASONS).nullable(),
    canVoid: z.boolean(),
    canDownload: z.boolean(),
    timeline: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string(),
        occurredAt: z.iso.datetime(),
        highlight: z.boolean(),
      }),
    ),
    filename: z.string(),
    contentType: z.literal("text/html"),
    content: z.string(),
  }),
});

export const voidPaymentInvoiceBodySchema = rejectClientTenantFields
  .extend({
    reason: z.enum(PAYMENT_INVOICE_VOID_REASONS),
  })
  .strict();

export const voidPaymentInvoiceResponseSchema = z.object({
  data: z.object({
    orderId: z.uuid(),
    invoiceNumber: z.string(),
    status: z.literal("void"),
    voidedAt: z.iso.datetime(),
    voidReason: z.enum(PAYMENT_INVOICE_VOID_REASONS),
  }),
});

export const paymentInstalmentsQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    productTitle: z.string().trim().min(1).max(256).optional(),
    pricingPlanLabel: z.string().trim().min(1).max(128).optional(),
    nextDue: z.enum(["overdue", "7days", "30days"]).optional(),
    sortBy: z
      .enum(["created_at", "remaining_amount_cents", "total_amount_cents", "next_due_at"])
      .default("created_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(PAYMENT_INSTALMENT_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PaymentInstalmentsQuery = z.output<typeof paymentInstalmentsQuerySchema>;

export const paymentInstalmentPlanItemSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    productTitle: z.string(),
    productType: z.string(),
    pricingPlanLabel: z.string().nullable(),
    totalAmountCents: z.number().int(),
    remainingAmountCents: z.number().int(),
    currency: z.string(),
    status: z.string(),
    createdAt: z.iso.datetime(),
    nextDueAt: z.iso.datetime().nullable(),
    instalmentCount: z.number().int().nonnegative(),
    paidCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
  })
  .strict();

export const paymentInstalmentsListResponseSchema = z.object({
  data: z.object({
    items: z.array(paymentInstalmentPlanItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: z.object({
      currency: z.string(),
      outstandingCents: z.number().int().nonnegative(),
      outstandingPlanCount: z.number().int().nonnegative(),
      dueNext7DaysCents: z.number().int().nonnegative(),
      overdueCents: z.number().int().nonnegative(),
      overdueInstalmentCount: z.number().int().nonnegative(),
      completedThisMonthCount: z.number().int().nonnegative(),
    }),
  }),
});

export const paymentInstalmentPlanParamsSchema = z
  .object({
    planId: z.uuid(),
  })
  .strict();

export const paymentInstalmentScheduleItemSchema = z
  .object({
    id: z.uuid(),
    sequenceNo: z.number().int(),
    amountCents: z.number().int(),
    dueAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    status: z.string(),
    paymentOrderId: z.uuid().nullable(),
  })
  .strict();

export const paymentInstalmentPlanDetailResponseSchema = z.object({
  data: z.object({
    plan: paymentInstalmentPlanItemSchema,
    instalments: z.array(paymentInstalmentScheduleItemSchema),
    activity: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.enum(["created", "paid", "cancelled", "note"]),
          label: z.string(),
          detail: z.string().nullable(),
          occurredAt: z.iso.datetime(),
          actorLabel: z.string().nullable(),
          tone: z.enum(["neutral", "success", "danger"]).default("neutral"),
        })
        .strict(),
    ),
    cancel: z
      .object({
        cancelledAt: z.iso.datetime(),
        reason: z.string(),
        accessOption: z.enum(["keep", "revoke"]),
        accessNote: z.string().nullable(),
      })
      .nullable(),
  }),
});

export const createPaymentInstalmentPlanBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.uuid(),
    productTitle: z.string().trim().min(1).max(256),
    productType: z.string().trim().min(1).max(64).default("course"),
    productId: z.uuid().optional(),
    pricingPlanLabel: z.string().trim().min(1).max(128).optional(),
    totalAmountCents: z.number().int().min(1),
    currency: z.string().length(3).default("USD"),
    instalments: z
      .array(
        z
          .object({
            amountCents: z.number().int().min(1),
            dueAt: z.iso.datetime(),
          })
          .strict(),
      )
      .min(2)
      .max(36),
    accessPolicy: z.enum(["immediate", "after_first_payment"]).default("after_first_payment"),
    automatedReminders: z.boolean().default(false),
    autoRevokeOnDefault: z.boolean().default(false),
    sendConfirmationEmail: z.boolean().default(false),
  })
  .strict()
  .superRefine((body, ctx) => {
    const sum = body.instalments.reduce((acc, item) => acc + item.amountCents, 0);
    if (sum !== body.totalAmountCents) {
      ctx.addIssue({
        code: "custom",
        message: "Instalment amounts must sum to the plan total.",
        path: ["instalments"],
      });
    }
  });

export const createPaymentInstalmentPlanResponseSchema = z.object({
  data: paymentInstalmentPlanItemSchema,
});

export const payPaymentInstalmentBodySchema = rejectClientTenantFields
  .extend({
    instalmentId: z.uuid().optional(),
    paymentMethod: z.enum(["gateway", "bank", "cash", "adjustment"]).default("gateway"),
    gatewayKey: z.string().trim().min(1).max(64).optional(),
    reference: z.string().trim().min(1).max(128).optional(),
    paidAt: z.iso.datetime().optional(),
    sendReceipt: z.boolean().default(false),
  })
  .strict();

export const payPaymentInstalmentResponseSchema = z.object({
  data: z.object({
    planId: z.uuid(),
    instalmentId: z.uuid(),
    paymentOrderId: z.uuid(),
    remainingAmountCents: z.number().int().nonnegative(),
    planStatus: z.string(),
    receiptQueued: z.boolean(),
  }),
});

export const PAYMENT_INSTALMENT_CANCEL_REASONS = [
  "too_expensive",
  "completed_goals",
  "no_time",
  "learner_request",
  "admin_correction",
  "other",
] as const;
export type PaymentInstalmentCancelReason = (typeof PAYMENT_INSTALMENT_CANCEL_REASONS)[number];

export const cancelPaymentInstalmentPlanBodySchema = rejectClientTenantFields
  .extend({
    reason: z.enum(PAYMENT_INSTALMENT_CANCEL_REASONS),
    accessOption: z.enum(["keep", "revoke"]).default("keep"),
  })
  .strict();

export type CancelPaymentInstalmentPlanBody = z.output<
  typeof cancelPaymentInstalmentPlanBodySchema
>;

export const cancelPaymentInstalmentPlanResponseSchema = z.object({
  data: z.object({
    planId: z.uuid(),
    status: z.literal("cancelled"),
    cancelledAt: z.iso.datetime(),
    reason: z.enum(PAYMENT_INSTALMENT_CANCEL_REASONS),
    accessOption: z.enum(["keep", "revoke"]),
    voidedInstalmentCount: z.number().int().nonnegative(),
  }),
});

export const exportPaymentRosterBodySchema = rejectClientTenantFields
  .extend({
    tab: z
      .enum(["transactions", "invoices", "instalments", "gateways", "refunds"])
      .default("transactions"),
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    productType: z.string().trim().min(1).max(64).optional(),
    gatewayKey: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    sortBy: z.string().trim().min(1).max(64).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportPaymentRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export const PAYMENT_OVERVIEW_GRAINS = ["day", "week", "month"] as const;
export type PaymentOverviewGrain = (typeof PAYMENT_OVERVIEW_GRAINS)[number];

export const paymentOverviewQuerySchema = rejectClientTenantFields
  .extend({
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    grain: z.enum(PAYMENT_OVERVIEW_GRAINS).default("day"),
  })
  .strict();

export type PaymentOverviewQuery = z.output<typeof paymentOverviewQuerySchema>;

export const paymentOverviewResponseSchema = z.object({
  data: z.object({
    summary: z.object({
      collectedCents: z.number().int().nonnegative(),
      currency: z.string(),
      currencies: z.array(z.string()),
      transactionCount: z.number().int().nonnegative(),
      averageOrderCents: z.number().int().nonnegative(),
      outstandingInstalmentCents: z.number().int().nonnegative(),
      outstandingPlanCount: z.number().int().nonnegative(),
      failedCount: z.number().int().nonnegative(),
      attemptCount: z.number().int().nonnegative(),
      failedPercent: z.number().nonnegative(),
      previousCollectedCents: z.number().int().nonnegative(),
      changePercent: z.number().nullable(),
      windowLabel: z.string(),
      windowFrom: z.iso.datetime(),
      windowTo: z.iso.datetime(),
    }),
    revenueTrend: z.array(
      z.object({
        date: z.string(),
        courseCents: z.number().int().nonnegative(),
        bundleCents: z.number().int().nonnegative(),
        subscriptionCents: z.number().int().nonnegative(),
        liveClassCents: z.number().int().nonnegative(),
        otherCents: z.number().int().nonnegative(),
        totalCents: z.number().int().nonnegative(),
        orderCount: z.number().int().nonnegative(),
      }),
    ),
    byGateway: z.array(
      z.object({
        gatewayKey: z.string(),
        displayName: z.string(),
        amountCents: z.number().int().nonnegative(),
        percent: z.number().nonnegative(),
      }),
    ),
    topProducts: z.array(
      z.object({
        productTitle: z.string(),
        productType: z.string(),
        amountCents: z.number().int().nonnegative(),
        orderCount: z.number().int().nonnegative(),
      }),
    ),
    attention: z.object({
      unsentInvoiceCount: z.number().int().nonnegative(),
      overdueInstalmentCount: z.number().int().nonnegative(),
      failedPaymentCount: z.number().int().nonnegative(),
    }),
    recentTransactions: z.array(paymentTransactionItemSchema),
  }),
});

export const paymentTransactionDetailParamsSchema = z
  .object({
    orderId: z.uuid(),
  })
  .strict();

export const PAYMENT_REFUND_REASONS = [
  "duplicate",
  "fraudulent",
  "customer_requested",
  "other",
] as const;

export type PaymentRefundReason = (typeof PAYMENT_REFUND_REASONS)[number];

const paymentTransactionEventSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    label: z.string(),
    description: z.string(),
    occurredAt: z.iso.datetime(),
    highlight: z.boolean(),
  })
  .strict();

const paymentTransactionFlowStepSchema = z
  .object({
    key: z.enum(["created", "authorized", "captured", "settled", "refunded", "failed"]),
    label: z.string(),
    status: z.enum(["complete", "current", "pending", "skipped"]),
    occurredAt: z.iso.datetime().nullable(),
  })
  .strict();

const paymentTransactionRefundRecordSchema = z
  .object({
    id: z.string(),
    status: z
      .enum([
        "requested",
        "processing",
        "pending",
        "succeeded",
        "failed",
        "reconciliation_required",
        "manual_adjustment",
        "legacy_recorded",
      ])
      .default("legacy_recorded"),
    fulfillment: z
      .enum(["gateway", "manual_adjustment", "legacy_recorded"])
      .default("legacy_recorded"),
    gatewayRefundId: z.string().optional(),
    amountCents: z.number().int().positive(),
    reason: z.string(),
    note: z.string().nullable(),
    mode: z.enum(["full", "partial"]),
    revokeAccess: z.boolean(),
    notifyLearner: z.boolean(),
    accessRevoked: z.boolean(),
    notifyQueued: z.boolean(),
    actorMembershipId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const paymentTransactionDetailResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    displayId: z.string(),
    membershipId: z.uuid().nullable(),
    status: z.string(),
    currency: z.string(),
    amountCents: z.number().int(),
    couponAmountCents: z.number().int().nullable(),
    taxAmountCents: z.number().int().nullable(),
    subtotalCents: z.number().int(),
    gatewayFeeCents: z.number().int().nullable(),
    netSettledCents: z.number().int().nullable(),
    couponCode: z.string().nullable(),
    gatewayKey: z.string().nullable(),
    externalId: z.string().nullable(),
    invoiceNumber: z.string().nullable(),
    paidAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    environment: z.enum(["live", "test", "unknown"]),
    learner: z.object({
      membershipId: z.uuid().nullable(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    }),
    product: z.object({
      title: z.string().nullable(),
      type: z.string().nullable(),
      sku: z.string().nullable(),
      courseId: z.uuid().nullable(),
      accessStatus: z.string().nullable(),
    }),
    billing: z.object({
      name: z.string().nullable(),
      addressLines: z.array(z.string()),
      taxId: z.string().nullable(),
    }),
    gateway: z.object({
      provider: z.string().nullable(),
      methodLabel: z.string().nullable(),
      brand: z.string().nullable(),
      last4: z.string().nullable(),
      networkRef: z.string().nullable(),
    }),
    risk: z
      .object({
        label: z.string(),
        score: z.number().nullable(),
        summary: z.string().nullable(),
      })
      .nullable(),
    flow: z.array(paymentTransactionFlowStepSchema),
    events: z.array(paymentTransactionEventSchema),
    refunds: z.array(paymentTransactionRefundRecordSchema),
    refundedAmountCents: z.number().int().nonnegative(),
    reservedRefundAmountCents: z.number().int().nonnegative().default(0),
    refundableAmountCents: z.number().int().nonnegative(),
    canRefund: z.boolean(),
    canDownloadInvoice: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
  }),
});

export type PaymentTransactionDetailResponse = z.output<
  typeof paymentTransactionDetailResponseSchema
>;

export const refundPaymentTransactionBodySchema = rejectClientTenantFields
  .extend({
    refundRequestId: z.uuid(),
    refundMethod: z.enum(["gateway", "manual_adjustment"]).default("gateway"),
    manualReference: z.string().trim().min(1).max(200).optional(),
    mode: z.enum(["full", "partial"]).default("full"),
    amountCents: z.number().int().positive().optional(),
    reason: z.enum(PAYMENT_REFUND_REASONS),
    note: z.string().trim().min(1).max(2000),
    revokeAccess: z.boolean().default(false),
    notifyLearner: z.boolean().default(true),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.refundMethod === "manual_adjustment" && !body.manualReference) {
      ctx.addIssue({
        code: "custom",
        message: "Manual adjustments require a reference.",
        path: ["manualReference"],
      });
    }
    if (body.mode === "partial" && body.amountCents == null) {
      ctx.addIssue({
        code: "custom",
        message: "Partial refunds require amountCents.",
        path: ["amountCents"],
      });
    }
  });

export type RefundPaymentTransactionBody = z.output<typeof refundPaymentTransactionBodySchema>;

export const refundPaymentTransactionResponseSchema = z.object({
  data: z.object({
    orderId: z.uuid(),
    status: z.string(),
    refund: paymentTransactionRefundRecordSchema,
    refundedAmountCents: z.number().int().nonnegative(),
    refundableAmountCents: z.number().int().nonnegative(),
    accessRevoked: z.boolean(),
    notifyQueued: z.boolean(),
    gatewayNote: z.string(),
  }),
});

export const PAYMENT_REFUNDS_QUEUES = ["refundable", "partial", "refunded", "all"] as const;

export type PaymentRefundsQueue = (typeof PAYMENT_REFUNDS_QUEUES)[number];

export const paymentRefundsQuerySchema = rejectClientTenantFields
  .extend({
    queue: z.enum(PAYMENT_REFUNDS_QUEUES).default("refundable"),
    paidFrom: z.iso.datetime().optional(),
    paidTo: z.iso.datetime().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    gatewayKey: z.string().trim().min(1).max(64).optional(),
    sortBy: z.enum(["paid_at", "created_at", "amount_cents"]).default("paid_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PaymentRefundsQuery = z.output<typeof paymentRefundsQuerySchema>;

export const paymentRefundsListResponseSchema = z.object({
  data: z.object({
    summary: z
      .object({
        refundableCount: z.number().int().nonnegative(),
        partialCount: z.number().int().nonnegative(),
        refundedCount: z.number().int().nonnegative(),
        refundableAmountCents: z.number().int().nonnegative(),
        refundedAmountCents: z.number().int().nonnegative(),
        currency: z.string(),
        windowFrom: z.iso.datetime().nullable(),
        windowTo: z.iso.datetime().nullable(),
      })
      .strict(),
    items: z.array(
      z
        .object({
          orderId: z.uuid(),
          membershipId: z.uuid().nullable(),
          learnerName: z.string().nullable(),
          email: z.string().nullable(),
          productTitle: z.string().nullable(),
          gatewayKey: z.string().nullable(),
          amountCents: z.number().int(),
          refundedAmountCents: z.number().int().nonnegative(),
          refundableAmountCents: z.number().int().nonnegative(),
          reservedRefundAmountCents: z.number().int().nonnegative().default(0),
          currency: z.string(),
          status: z.string(),
          invoiceNumber: z.string().nullable(),
          paidAt: z.iso.datetime().nullable(),
          createdAt: z.iso.datetime(),
          canRefund: z.boolean(),
          refundCount: z.number().int().nonnegative(),
          latestRefund: paymentTransactionRefundRecordSchema.nullable(),
        })
        .strict(),
    ),
    pageInfo: pageInfoSchema,
    capabilities: z
      .object({
        requestQueue: z.boolean(),
        disputesAvailable: z.boolean(),
        gatewayRefundsAutomated: z.boolean(),
      })
      .strict(),
  }),
});
