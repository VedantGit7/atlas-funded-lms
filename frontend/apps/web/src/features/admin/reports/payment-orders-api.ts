import { clientApi } from "../../../lib/client-api";

/**
 * Client for the payment order ledger.
 *
 * Orders are the raw rows gateway webhooks settle against: a Stripe or Razorpay
 * webhook finds an order by `externalId` and writes `status` and `paidAt` onto
 * it. That is why this screen exists — when settlement goes wrong, the order row
 * is the only place the mismatch is visible.
 */

export const PAYMENT_ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "cancelled",
] as const;

export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export type PaymentOrderSettlement = "settled" | "unsettled";

export const PAYMENT_ORDER_PAGE_SIZE = 50;

export type PaymentOrder = {
  id: string;
  membershipId: string | null;
  externalId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export type PaymentOrderPageInfo = {
  /** Opaque keyset cursor; never parse it here. */
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type PaymentOrderSummary = {
  total: number;
  byStatus: Record<string, number>;
  missingExternalId: number;
  paidWithoutTimestamp: number;
  totalsByCurrency: Array<{ currency: string; amountCents: number; count: number }>;
  /**
   * A real authorization decision, not a UI hint.
   *
   * Reading the ledger is `reports.run`; recording an order is `config.update`.
   * The server evaluates the same permission against the same resource the
   * create route enforces, so the form can say "you cannot do this" before it
   * is filled in rather than after a 403.
   */
  capabilities: { canRecord: boolean };
};

export type PaymentOrderFilters = {
  status?: string;
  q?: string;
  currency?: string;
  settlement?: PaymentOrderSettlement;
};

function toParams(filters: PaymentOrderFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.currency) params.set("currency", filters.currency);
  if (filters.settlement) params.set("settlement", filters.settlement);
  return params;
}

export async function fetchPaymentOrders(
  filters: PaymentOrderFilters,
  cursor?: string,
): Promise<{ items: PaymentOrder[]; pageInfo: PaymentOrderPageInfo }> {
  const params = toParams(filters);
  params.set("limit", String(PAYMENT_ORDER_PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);

  const response = await clientApi.get<{
    data: { items: PaymentOrder[]; pageInfo: PaymentOrderPageInfo };
  }>(`/api/v1/payments/orders?${params.toString()}`);
  return response.data;
}

/**
 * Ledger-wide totals for the same filters the table is showing.
 *
 * Separate from the page because these are totals, not a window: "7 pending"
 * has to mean the ledger, not the fifty rows currently loaded.
 */
export async function fetchPaymentOrderSummary(
  filters: PaymentOrderFilters,
): Promise<PaymentOrderSummary> {
  const params = toParams(filters);
  const query = params.toString();
  const response = await clientApi.get<{ data: PaymentOrderSummary }>(
    query ? `/api/v1/payments/orders/summary?${query}` : "/api/v1/payments/orders/summary",
  );
  return response.data;
}

export type PaymentOrderDetail = PaymentOrder & {
  gatewayKey: string | null;
  productTitle: string | null;
  productType: string | null;
  couponAmountCents: number | null;
  taxAmountCents: number | null;
  invoiceNumber: string | null;
  billingName: string | null;
  updatedAt: string;
  metadataJson: Record<string, unknown> | null;
};

/**
 * One order by id.
 *
 * A real lookup rather than a search through whatever the ledger list happened
 * to load: the list is cursor-paginated, so an older order was previously
 * indistinguishable from one that does not exist.
 */
export async function fetchPaymentOrder(orderId: string): Promise<PaymentOrderDetail> {
  const response = await clientApi.get<{ data: PaymentOrderDetail }>(
    `/api/v1/payments/orders/${encodeURIComponent(orderId)}`,
  );
  return response.data;
}

export type LearnerSearchResult = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
};

/**
 * Learner lookup for the membership field.
 *
 * The form used to demand a raw membership UUID, which an operator had to go
 * and find on another screen — and a mistyped one attributes a payment to the
 * wrong learner with nothing to catch it.
 */
export async function searchLearners(term: string): Promise<LearnerSearchResult[]> {
  const params = new URLSearchParams({ search: term.trim(), limit: "8", status: "ACTIVE" });
  const response = await clientApi.get<{
    data: {
      items: Array<{
        id: string;
        invitedEmail?: string | null;
        accountEmail?: string | null;
        profile: { displayName: string | null } | null;
      }>;
    };
  }>(`/api/v1/members?${params.toString()}`);

  return response.data.items.map((member) => ({
    membershipId: member.id,
    displayName: member.profile?.displayName ?? null,
    email: member.accountEmail ?? member.invitedEmail ?? null,
  }));
}

export async function createPaymentOrder(input: {
  amountCents: number;
  currency: string;
  status: PaymentOrderStatus;
  membershipId?: string;
  externalId?: string;
  /** Free-text reason, stored on the order so the entry explains itself later. */
  note?: string;
}): Promise<PaymentOrder> {
  const { note, ...rest } = input;
  const response = await clientApi.post<{ data: PaymentOrder }>(
    "/api/v1/payments/orders",
    {
      ...rest,
      // A manual order is an assertion that money arrived somewhere this system
      // cannot see. Six months later the reason is the only thing that makes
      // the row auditable, so it rides along in the order's metadata.
      ...(note ? { metadataJson: { manualEntryNote: note } } : {}),
    },
    "payment-order-create",
    { successMessage: "Payment order recorded." },
  );
  return response.data;
}

export type PaymentOrdersExport = {
  items: PaymentOrder[];
  /** How many orders match the filters in the whole ledger. */
  totalCount: number;
  /** True when the ledger holds more matching orders than this response carries. */
  truncated: boolean;
  limit: number;
};

/**
 * The whole filtered ledger, for a downloadable file.
 *
 * Distinct from `fetchPaymentOrders` on purpose: that one is a cursor page and
 * exporting through it would take one request per fifty rows, with a webhook
 * free to write a new order between them — producing a file that is a snapshot
 * of nothing. This is a single read with a server-side ceiling, and it says so
 * when the ceiling is reached rather than truncating silently.
 */
export async function fetchPaymentOrdersExport(
  filters: PaymentOrderFilters,
): Promise<PaymentOrdersExport> {
  const query = toParams(filters).toString();
  const response = await clientApi.get<{ data: PaymentOrdersExport }>(
    query ? `/api/v1/payments/orders/export?${query}` : "/api/v1/payments/orders/export",
  );
  return response.data;
}

/** The three ways an order can fail to reconcile. Mirrors the server enum. */
export const PAYMENT_ORDER_FAULTS = [
  "missing-external-id",
  "stale-pending",
  "paid-without-timestamp",
] as const;

export type PaymentOrderFault = (typeof PAYMENT_ORDER_FAULTS)[number];

export type UnmatchedOrderGroup = {
  fault: PaymentOrderFault;
  /** Ledger-wide, never the length of `items`. */
  total: number;
  items: PaymentOrder[];
  truncated: boolean;
};

export type UnmatchedPaymentOrders = {
  groups: UnmatchedOrderGroup[];
  /** Distinct affected orders — not the sum of the group totals. */
  affectedTotal: number;
  scannedTotal: number;
  oldest: { id: string; externalId: string | null; createdAt: string } | null;
  stalePendingDays: number;
  sampleLimit: number;
  capabilities: { canRecord: boolean };
};

/**
 * The reconciliation worklist.
 *
 * A ledger-wide scan, which is the whole point: a worklist derived from the
 * fifty rows a screen happened to load reports clean books while the stuck
 * order sits on page nine. Only the row samples are capped; the counts are not.
 */
export async function fetchUnmatchedPaymentOrders(
  stalePendingDays: number,
): Promise<UnmatchedPaymentOrders> {
  const params = new URLSearchParams({ stalePendingDays: String(stalePendingDays) });
  const response = await clientApi.get<{ data: UnmatchedPaymentOrders }>(
    `/api/v1/payments/orders/unmatched?${params.toString()}`,
  );
  return response.data;
}
