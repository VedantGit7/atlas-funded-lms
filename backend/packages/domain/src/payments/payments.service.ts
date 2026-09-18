import { can, createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createPaymentOrderBodySchema,
  createPaymentOrderResponseSchema,
  listPaymentOrdersQuerySchema,
  listPaymentOrdersResponseSchema,
  paymentOrderDetailResponseSchema,
  exportPaymentOrdersQuerySchema,
  exportPaymentOrdersResponseSchema,
  PAYMENT_ORDER_EXPORT_LIMIT,
  PAYMENT_ORDER_FAULTS,
  PAYMENT_ORDER_UNMATCHED_SAMPLE_LIMIT,
  paymentOrderSummaryQuerySchema,
  paymentOrderSummaryResponseSchema,
  unmatchedPaymentOrdersQuerySchema,
  unmatchedPaymentOrdersResponseSchema,
  stripeWebhookBodySchema,
  stripeWebhookResponseSchema,
} from "./payments.dto";
import { paymentsRosterRepository } from "../reports/payments-roster.repository";
import { paymentOrderNotFound } from "./payments.errors";
import {
  paymentsRepository,
  type PaymentOrderFilter,
  type PaymentOrderRow,
} from "./payments.repository";

function toDto(row: PaymentOrderRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    externalId: row.external_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    paidAt: row.paid_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createPaymentOrder(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createPaymentOrderBodySchema.parse(rawBody);
  const row = await paymentsRepository.insertOrder(tx, {
    membershipId: body.membershipId ?? ctx.actorMembershipId,
    externalId: body.externalId ?? null,
    amountCents: body.amountCents,
    currency: body.currency,
    status: body.status,
    metadataJson: body.metadataJson,
  });

  return createPaymentOrderResponseSchema.parse({ data: toDto(row) });
}

type OrderCursor = { createdAt: Date; id: string };

/**
 * The ledger's keyset cursor.
 *
 * It carries `created_at` as well as `id` because the ledger is ordered by
 * both. A cursor holding only the id cannot express the boundary: v4 UUIDs do
 * not sort with the timestamps, so comparing ids alone skips rows.
 */
function encodeOrderCursor(cursor: OrderCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
    "utf8",
  ).toString("base64url");
}

/**
 * A malformed cursor returns the first page rather than throwing.
 *
 * It always arrives from our own `nextCursor`, so a bad one means a truncated
 * or hand-edited URL — and starting over is a better answer there than a 400 on
 * a page the operator only wanted to read.
 */
function decodeOrderCursor(raw: string | undefined): OrderCursor | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return undefined;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return undefined;
    return { createdAt, id: parsed.id };
  } catch {
    return undefined;
  }
}

/** `exactOptionalPropertyTypes` is on, so absent filters must be absent keys. */
function toOrderFilter(query: {
  status?: string | undefined;
  q?: string | undefined;
  currency?: string | undefined;
  settlement?: "settled" | "unsettled" | undefined;
}): PaymentOrderFilter {
  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.q !== undefined ? { q: query.q } : {}),
    // Currency codes are stored upper-case; an operator typing "inr" means INR.
    ...(query.currency !== undefined ? { currency: query.currency.toUpperCase() } : {}),
    ...(query.settlement !== undefined ? { settlement: query.settlement } : {}),
  };
}

/**
 * One order, with the columns the ledger list leaves out.
 *
 * A 404 here is a real "no such order in this tenant" — the detail screen used
 * to be built from whatever the list had already loaded, so an order further
 * back in the cursor-paginated history looked missing when it was merely
 * unfetched.
 */
export async function getPaymentOrder(tx: TenantTx, _ctx: ServiceCtx, orderId: string) {
  const row = await paymentsRepository.findOrderById(tx, orderId);
  if (!row) throw paymentOrderNotFound();

  return paymentOrderDetailResponseSchema.parse({
    data: {
      ...toDto(row),
      gatewayKey: row.gateway_key,
      productTitle: row.product_title,
      productType: row.product_type,
      couponAmountCents: row.coupon_amount_cents,
      taxAmountCents: row.tax_amount_cents,
      invoiceNumber: row.invoice_number,
      billingName: row.billing_name,
      updatedAt: row.updated_at.toISOString(),
      metadataJson:
        row.metadata_json === null || typeof row.metadata_json !== "object"
          ? null
          : (row.metadata_json as Record<string, unknown>),
    },
  });
}

export async function listPaymentOrders(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = listPaymentOrdersQuerySchema.parse(rawQuery);
  const cursor = decodeOrderCursor(query.cursor);

  const rows = await paymentsRepository.listOrders(tx, {
    limit: query.limit,
    ...toOrderFilter(query),
    ...(cursor ? { cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);

  return listPaymentOrdersResponseSchema.parse({
    data: {
      items: page.map(toDto),
      pageInfo: {
        // Built from the row, not the DTO: the cursor needs the raw
        // `created_at`, which the DTO has already turned into a string.
        nextCursor:
          hasNextPage && last
            ? encodeOrderCursor({ createdAt: last.created_at, id: last.id })
            : null,
        hasNextPage,
      },
    },
  });
}

/**
 * The filtered ledger as one set of rows, for a CSV the operator downloads.
 *
 * The screen's own export could only ever cover the rows already loaded — fifty
 * at a time — so exporting a year of orders meant clicking "Load more" a
 * hundred times first. The count comes from the same summary aggregate the
 * ledger header uses, so `truncated` is a statement about the whole filtered
 * set rather than about this response.
 */
export async function exportPaymentOrders(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = exportPaymentOrdersQuerySchema.parse(rawQuery);
  const filter = toOrderFilter(query);

  const [rows, buckets] = await Promise.all([
    paymentsRepository.exportOrders(tx, { ...filter, limit: PAYMENT_ORDER_EXPORT_LIMIT }),
    paymentsRepository.summariseOrders(tx, filter),
  ]);

  const totalCount = buckets.reduce((sum, bucket) => sum + Number(bucket.total), 0);

  return exportPaymentOrdersResponseSchema.parse({
    data: {
      items: rows.map(toDto),
      totalCount,
      truncated: totalCount > rows.length,
      limit: PAYMENT_ORDER_EXPORT_LIMIT,
    },
  });
}

/**
 * Ledger-wide counts for the filtered set.
 *
 * Separate from the page because the page is a window and these are totals: an
 * operator reading "7 pending" needs it to mean the ledger, not the fifty rows
 * that happen to be loaded.
 */
export async function summarisePaymentOrders(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = paymentOrderSummaryQuerySchema.parse(rawQuery);
  const buckets = await paymentsRepository.summariseOrders(tx, toOrderFilter(query));

  // The same permission and the same resource the create route enforces, so the
  // answer here cannot drift from what the write would actually decide.
  const decision = await can({
    tx,
    actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
    permission: "config.update",
    resource: createTenantResourceRef({
      type: "tenant_config",
      id: ctx.tenantId,
      tenantId: ctx.tenantId,
    }),
    ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
  });

  const byStatus: Record<string, number> = {};
  const byCurrency = new Map<string, { amountCents: number; count: number }>();
  let total = 0;
  let missingExternalId = 0;
  let paidWithoutTimestamp = 0;

  for (const bucket of buckets) {
    const count = Number(bucket.total);
    total += count;
    byStatus[bucket.status] = (byStatus[bucket.status] ?? 0) + count;
    missingExternalId += Number(bucket.missing_external_id);
    paidWithoutTimestamp += Number(bucket.paid_without_timestamp);

    const currency = byCurrency.get(bucket.currency) ?? { amountCents: 0, count: 0 };
    currency.amountCents += Number(bucket.amount_cents);
    currency.count += count;
    byCurrency.set(bucket.currency, currency);
  }

  return paymentOrderSummaryResponseSchema.parse({
    data: {
      total,
      byStatus,
      missingExternalId,
      paidWithoutTimestamp,
      // Never a single grand total: adding INR to USD produces a number that
      // means nothing and looks authoritative.
      totalsByCurrency: [...byCurrency.entries()]
        .map(([currency, value]) => ({ currency, ...value }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      capabilities: { canRecord: decision.allowed },
    },
  });
}

/**
 * The reconciliation worklist: every order the ledger cannot settle by itself.
 *
 * Three faults, each derived from the row alone. Deliberately a ledger-wide
 * scan rather than a pass over a loaded page — a worklist assembled from the
 * fifty rows a screen happened to fetch tells an operator their books are clean
 * when the stuck order is on page nine, which is worse than not asking.
 *
 * The counts come from one aggregate and the rows from one query per fault, so
 * a group can say "3 of 214" honestly: the sample is capped, the count is not.
 */
export async function getUnmatchedPaymentOrders(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = unmatchedPaymentOrdersQuerySchema.parse(rawQuery);
  const { stalePendingDays } = query;
  const limit = PAYMENT_ORDER_UNMATCHED_SAMPLE_LIMIT;

  const [counts, oldest, ...samples] = await Promise.all([
    paymentsRepository.countUnmatchedOrders(tx, { stalePendingDays }),
    paymentsRepository.findOldestUnmatchedOrder(tx, { stalePendingDays }),
    ...PAYMENT_ORDER_FAULTS.map(async (fault) =>
      paymentsRepository.listUnmatchedOrders(tx, { fault, stalePendingDays, limit }),
    ),
  ]);

  // Recording a manual order is the usual resolution for a stuck one, and it
  // needs `config.update` — a permission reading this worklist does not imply.
  const decision = await can({
    tx,
    actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
    permission: "config.update",
    resource: createTenantResourceRef({
      type: "tenant_config",
      id: ctx.tenantId,
      tenantId: ctx.tenantId,
    }),
    ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
  });

  const totals: Record<string, number> = {
    "missing-external-id": Number(counts.missing_external_id),
    "stale-pending": Number(counts.stale_pending),
    "paid-without-timestamp": Number(counts.paid_without_timestamp),
  };

  return unmatchedPaymentOrdersResponseSchema.parse({
    data: {
      groups: PAYMENT_ORDER_FAULTS.map((fault, index) => {
        const items = samples[index] ?? [];
        const total = totals[fault] ?? 0;
        return {
          fault,
          total,
          items: items.map(toDto),
          truncated: total > items.length,
        };
      }),
      affectedTotal: Number(counts.affected),
      scannedTotal: Number(counts.scanned),
      oldest:
        oldest === null
          ? null
          : {
              id: oldest.id,
              externalId: oldest.external_id,
              createdAt: oldest.created_at.toISOString(),
            },
      stalePendingDays,
      sampleLimit: limit,
      capabilities: { canRecord: decision.allowed },
    },
  });
}

export async function handleStripeWebhook(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  // Legacy JSON stub retained for typed contract compatibility.
  // Live Stripe webhooks use raw body + PaymentProvider.parseWebhook in the route handler.
  const body = stripeWebhookBodySchema.parse(rawBody);
  const current = await paymentsRepository.findByExternalId(tx, body.externalId);
  if (!current) {
    throw paymentOrderNotFound();
  }

  const invoiceNumber =
    body.status === "paid" && !current.invoice_number
      ? await paymentsRosterRepository.allocateInvoiceNumber(tx)
      : null;

  const row = await paymentsRepository.updateOrderByExternalId(tx, {
    externalId: body.externalId,
    status: body.status,
    paidAt: body.paidAt ? new Date(body.paidAt) : body.status === "paid" ? new Date() : null,
    invoiceNumber,
  });

  if (!row) {
    throw paymentOrderNotFound();
  }

  return stripeWebhookResponseSchema.parse({
    data: { updated: true, orderId: row.id },
  });
}
