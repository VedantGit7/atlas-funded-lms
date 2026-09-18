import { z } from "zod";
import { PAYMENT_ORDER_STATUSES, rejectClientTenantFields } from "../shared/domain.dto";

export const createPaymentOrderBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.uuid().optional(),
    externalId: z.string().max(256).optional(),
    amountCents: z.number().int().min(0),
    currency: z.string().length(3).default("USD"),
    status: z.enum(PAYMENT_ORDER_STATUSES).default("pending"),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** Settlement is derived from `paid_at`, not stored, so it is its own filter. */
export const PAYMENT_ORDER_SETTLEMENTS = ["settled", "unsettled"] as const;

export const listPaymentOrdersQuerySchema = rejectClientTenantFields
  .extend({
    /**
     * Opaque keyset cursor carrying `created_at` and `id`.
     *
     * It used to be a bare uuid compared with `id < cursor` while the ledger was
     * ordered by `created_at desc, id desc`. Ids here are random v4 UUIDs, so
     * they do not sort with the timestamps, and the boundary dropped rows: an
     * operator paging a financial ledger silently never saw some orders.
     */
    cursor: z.string().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(PAYMENT_ORDER_STATUSES).optional(),
    /** Matches external id, membership id or order id — the handles an operator has. */
    q: z.string().trim().min(1).max(200).optional(),
    currency: z.string().trim().length(3).optional(),
    settlement: z.enum(PAYMENT_ORDER_SETTLEMENTS).optional(),
  })
  .strict();

/** Same filters as the list; the summary must describe the set the page shows. */
export const paymentOrderSummaryQuerySchema = rejectClientTenantFields
  .extend({
    status: z.enum(PAYMENT_ORDER_STATUSES).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    currency: z.string().trim().length(3).optional(),
    settlement: z.enum(PAYMENT_ORDER_SETTLEMENTS).optional(),
  })
  .strict();

/**
 * The order ledger's own page info.
 *
 * The shared `pageInfoSchema` types `nextCursor` as a uuid, which is exactly the
 * assumption that broke pagination here. Keeping this local avoids re-typing the
 * cursor on every other endpoint that legitimately pages by id.
 */
export const paymentOrderPageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

/**
 * Ledger-wide counts for the filtered set.
 *
 * Computed server-side because the alternative — counting the rows already
 * loaded — reports "3 failed" when it means "3 failed on this page", which on a
 * paginated ledger is worse than showing nothing at all.
 */
export const paymentOrderSummarySchema = z.object({
  total: z.number().int().min(0),
  byStatus: z.record(z.string(), z.number().int().min(0)),
  /** Orders no webhook can ever settle, because there is nothing to match on. */
  missingExternalId: z.number().int().min(0),
  /** Marked paid with no `paid_at`: settled, but not when. */
  paidWithoutTimestamp: z.number().int().min(0),
  /** Totals per currency in minor units. Never summed across currencies. */
  totalsByCurrency: z.array(
    z.object({
      currency: z.string(),
      amountCents: z.number().int(),
      count: z.number().int().min(0),
    }),
  ),
  /**
   * What this operator may do here.
   *
   * Reading the ledger is `reports.run`; recording an order is `config.update`,
   * so an analyst can legitimately hold the first and not the second. Answering
   * that server-side lets the screen say so before the form is filled in,
   * rather than after a 403 throws the typing away.
   */
  capabilities: z.object({
    canRecord: z.boolean(),
  }),
});

export const paymentOrderSummaryResponseSchema = z.object({
  data: paymentOrderSummarySchema,
});

export const stripeWebhookBodySchema = z
  .object({
    externalId: z.string().min(1),
    status: z.enum(PAYMENT_ORDER_STATUSES),
    paidAt: z.iso.datetime().optional(),
  })
  .strict();

export const paymentOrderDtoSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid().nullable(),
    externalId: z.string().nullable(),
    amountCents: z.number().int(),
    currency: z.string(),
    status: z.string(),
    paidAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

/**
 * One order, in full.
 *
 * The list DTO carries the eight columns a ledger row needs; the table holds
 * more, and a detail screen exists precisely to answer the questions the list
 * cannot — which gateway, against which invoice, and for a manually recorded
 * order, why it was recorded at all.
 */
export const paymentOrderDetailDtoSchema = paymentOrderDtoSchema.extend({
  gatewayKey: z.string().nullable(),
  productTitle: z.string().nullable(),
  productType: z.string().nullable(),
  couponAmountCents: z.number().int().nullable(),
  taxAmountCents: z.number().int().nullable(),
  invoiceNumber: z.string().nullable(),
  billingName: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  /**
   * Whatever was stored alongside the order.
   *
   * Rendered rather than hidden: for a manual entry this holds the operator's
   * stated reason, which is usually the only thing that explains the row.
   */
  metadataJson: z.record(z.string(), z.unknown()).nullable(),
});

export const paymentOrderDetailResponseSchema = z.object({
  data: paymentOrderDetailDtoSchema,
});

/**
 * The most rows one export may return.
 *
 * An export is a single response, not a paged read, so it needs a ceiling. The
 * response says whether it was hit rather than silently truncating — a finance
 * export that quietly stops at row 10,000 is worse than one that refuses.
 */
export const PAYMENT_ORDER_EXPORT_LIMIT = 10000;

/** Same filters as the list, so an export matches what the operator was looking at. */
export const exportPaymentOrdersQuerySchema = rejectClientTenantFields
  .extend({
    status: z.enum(PAYMENT_ORDER_STATUSES).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    currency: z.string().trim().length(3).optional(),
    settlement: z.enum(PAYMENT_ORDER_SETTLEMENTS).optional(),
  })
  .strict();

export const exportPaymentOrdersResponseSchema = z.object({
  data: z.object({
    items: z.array(paymentOrderDtoSchema),
    /** How many rows matched the filters in total. */
    totalCount: z.number().int().min(0),
    /** True when `totalCount` exceeds what this response carries. */
    truncated: z.boolean(),
    limit: z.number().int().min(1),
  }),
});

/**
 * The three ways an order can fail to reconcile.
 *
 * Each is derived from the row alone — none of them asks a gateway anything, so
 * none of them can be stale. They are not mutually exclusive: an order with no
 * external id that has also sat pending for a fortnight belongs in two groups,
 * and a worklist that silently picked one would hide half the reason it is
 * stuck.
 */
export const PAYMENT_ORDER_FAULTS = [
  "missing-external-id",
  "stale-pending",
  "paid-without-timestamp",
] as const;

/**
 * How long a pending order has to sit before it is worth looking at.
 *
 * Seven days is a default, not a fact — a tenant selling instalments against
 * bank transfer settles far slower than one taking cards — so it is a parameter
 * rather than a constant buried in a query.
 */
export const PAYMENT_ORDER_STALE_PENDING_DAYS_DEFAULT = 7;

/** How many rows one fault group returns. The counts are not capped. */
export const PAYMENT_ORDER_UNMATCHED_SAMPLE_LIMIT = 50;

export const unmatchedPaymentOrdersQuerySchema = rejectClientTenantFields
  .extend({
    stalePendingDays: z.coerce
      .number()
      .int()
      .min(1)
      .max(90)
      .default(PAYMENT_ORDER_STALE_PENDING_DAYS_DEFAULT),
  })
  .strict();

const unmatchedPaymentOrderGroupSchema = z.object({
  fault: z.enum(PAYMENT_ORDER_FAULTS),
  /** Ledger-wide, never the length of `items`. */
  total: z.number().int().min(0),
  items: z.array(paymentOrderDtoSchema),
  /** True when the ledger holds more of this fault than `items` carries. */
  truncated: z.boolean(),
});

export const unmatchedPaymentOrdersResponseSchema = z.object({
  data: z.object({
    groups: z.array(unmatchedPaymentOrderGroupSchema),
    /**
     * Distinct orders carrying at least one fault — not the sum of the group
     * totals, which double-counts an order that is stuck for two reasons.
     */
    affectedTotal: z.number().int().min(0),
    /** Every order in the ledger, so the figure above has a denominator. */
    scannedTotal: z.number().int().min(0),
    /** The longest-standing affected order, or null when there are none. */
    oldest: z
      .object({
        id: z.uuid(),
        externalId: z.string().nullable(),
        createdAt: z.iso.datetime(),
      })
      .nullable(),
    stalePendingDays: z.number().int(),
    sampleLimit: z.number().int(),
    capabilities: z.object({ canRecord: z.boolean() }),
  }),
});

export const createPaymentOrderResponseSchema = z.object({
  data: paymentOrderDtoSchema,
});

export const listPaymentOrdersResponseSchema = z.object({
  data: z.object({
    items: z.array(paymentOrderDtoSchema),
    pageInfo: paymentOrderPageInfoSchema,
  }),
});

export const paymentWebhookResponseSchema = z.object({
  data: z.object({
    updated: z.boolean(),
    orderId: z.uuid().nullable(),
  }),
});

export const stripeWebhookResponseSchema = paymentWebhookResponseSchema;
export const razorpayWebhookResponseSchema = paymentWebhookResponseSchema;
