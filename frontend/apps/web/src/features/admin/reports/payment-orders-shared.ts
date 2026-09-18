import { csvRow } from "../../../lib/export/csv";
import type { PaymentOrder, PaymentOrderFault } from "./payment-orders-api";

/**
 * Presentation vocabulary for the payment order ledger.
 *
 * Every surface resolves through `--admin-*` tokens, so the ledger renders in
 * both themes; and every derived figure lives here rather than inline, because
 * the difference between "0" and "unknown" on a financial screen is the whole
 * point.
 */

export const ordersNoteClassName =
  "flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4";

export const ordersSignalCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4";

export const ordersSignalLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const ordersSignalValueClassName =
  "font-data mt-2 block text-2xl font-light tabular-nums text-[var(--admin-on-surface)]";

export const ordersToolbarClassName =
  "flex flex-wrap items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3";

export const ordersTableShellClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)]";

export const ordersTableHeadCellClassName =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const ordersRowClassName =
  "group border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_65%,transparent)]";

export const ordersRowSelectedClassName =
  "bg-[color-mix(in_srgb,var(--admin-primary)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]";

/** A row carrying an operational fault gets a warning rail, not a red row. */
export const ordersRowFaultClassName =
  "bg-[color-mix(in_srgb,var(--admin-warning)_7%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-warning)_11%,transparent)]";

export const ordersCheckboxClassName =
  "h-4 w-4 shrink-0 cursor-pointer accent-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]";

export const ordersSelectionBarClassName =
  "admin-glass sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out] lg:flex-row lg:items-center lg:justify-between";

export const ordersEmptyPanelClassName =
  "admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center";

export const ordersFieldClassName =
  "rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25";

export function statusChipClassName(status: string): string {
  const base =
    "font-data inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (status === "paid") {
    return `${base} border-[color-mix(in_srgb,var(--admin-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]`;
  }
  if (status === "pending") {
    return `${base} border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]`;
  }
  if (status === "failed" || status === "refunded") {
    return `${base} border-[color-mix(in_srgb,var(--admin-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]`;
  }
  return `${base} border-[color-mix(in_srgb,var(--admin-on-surface-variant)_40%,transparent)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
}

/**
 * Money, from minor units, in the order's own currency.
 *
 * An unrecognised currency code must not blank the cell or throw — a ledger row
 * imported from a legacy system still has to be readable, so the code is
 * appended verbatim instead.
 */
export function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatTimestamp(iso: string | null): string {
  if (iso === null) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type OrderFault = "missing-external-id" | "paid-without-timestamp";

/**
 * What is operationally wrong with a row, if anything.
 *
 * Both faults are silent in every other view. An order with no external id can
 * never be matched by a webhook, so it will sit pending for ever; an order
 * marked paid with no `paidAt` settled at a time nobody can state. Neither is a
 * failed payment, which is why they are warnings rather than errors.
 */
export function orderFaults(order: PaymentOrder): OrderFault[] {
  const faults: OrderFault[] = [];
  // A whitespace-only id matches nothing, exactly like a null one.
  if (order.externalId === null || order.externalId.trim() === "") {
    faults.push("missing-external-id");
  }
  if (order.status === "paid" && order.paidAt === null) {
    faults.push("paid-without-timestamp");
  }
  return faults;
}

export function faultLabel(fault: OrderFault): string {
  return fault === "missing-external-id"
    ? "No external ID — a webhook cannot settle this"
    : "Marked paid without a settlement timestamp";
}

/**
 * Selection totals, one per currency.
 *
 * Never a single grand total: adding INR to USD produces a number that means
 * nothing and looks authoritative on a screen full of real figures.
 */
export function totalsByCurrency(
  orders: PaymentOrder[],
): Array<{ currency: string; amountCents: number }> {
  const totals = new Map<string, number>();
  for (const order of orders) {
    totals.set(order.currency, (totals.get(order.currency) ?? 0) + order.amountCents);
  }
  return [...totals.entries()]
    .map(([currency, amountCents]) => ({ currency, amountCents }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * The columns an order export can carry.
 *
 * A table rather than a fixed header row, because the export screen lets the
 * operator choose: a reconciliation file wants ids and amounts and nothing
 * else, while a support hand-off wants the fault column that reconciliation
 * would only find noisy. Order here is the order in the file, so choosing
 * columns never reorders them.
 */
export const ORDER_EXPORT_COLUMNS = [
  { key: "id", label: "Order ID", value: (order: PaymentOrder) => order.id },
  {
    key: "externalId",
    label: "External ID",
    value: (order: PaymentOrder) => order.externalId ?? "",
  },
  {
    key: "membershipId",
    label: "Membership ID",
    value: (order: PaymentOrder) => order.membershipId ?? "",
  },
  { key: "status", label: "Status", value: (order: PaymentOrder) => order.status },
  {
    key: "amount",
    label: "Amount",
    // Minor units divided out, but unformatted: a spreadsheet needs a number it
    // can sum, not a localised currency string.
    value: (order: PaymentOrder) => (order.amountCents / 100).toFixed(2),
  },
  { key: "currency", label: "Currency", value: (order: PaymentOrder) => order.currency },
  { key: "createdAt", label: "Created", value: (order: PaymentOrder) => order.createdAt },
  { key: "paidAt", label: "Paid at", value: (order: PaymentOrder) => order.paidAt ?? "" },
  {
    key: "faults",
    label: "Faults",
    value: (order: PaymentOrder) => orderFaults(order).map(faultLabel).join("; "),
  },
] as const;

export type OrderExportColumnKey = (typeof ORDER_EXPORT_COLUMNS)[number]["key"];

export const ALL_ORDER_EXPORT_COLUMN_KEYS: OrderExportColumnKey[] = ORDER_EXPORT_COLUMNS.map(
  (column) => column.key,
);

/**
 * CSV of the ledger rows.
 *
 * Through the shared escaper: `externalId` is supplied by a payment gateway and
 * lands in a file an administrator opens in a spreadsheet.
 *
 * Passing no columns means every column, so the quick export from the ledger
 * toolbar keeps behaving as it did.
 */
export function ordersToCsv(
  orders: PaymentOrder[],
  columnKeys: ReadonlyArray<OrderExportColumnKey> = ALL_ORDER_EXPORT_COLUMN_KEYS,
): string {
  const selected = ORDER_EXPORT_COLUMNS.filter((column) => columnKeys.includes(column.key));
  // Every column deselected would otherwise produce a file of empty lines that
  // looks like a broken export rather than an empty choice.
  const columns = selected.length > 0 ? selected : ORDER_EXPORT_COLUMNS;

  return [
    csvRow(columns.map((column) => column.label)),
    ...orders.map((order) => csvRow(columns.map((column) => column.value(order)))),
  ].join("\r\n");
}

/**
 * The filename an export downloads as.
 *
 * The filters are in the name because these files accumulate in a downloads
 * folder, and `payment-orders-2026-08-26.csv` twice over — once filtered to
 * failed orders, once not — is indistinguishable at the point it matters.
 */
export function orderExportFilename(filters: {
  status?: string;
  currency?: string;
  settlement?: string;
  q?: string;
}): string {
  const parts = ["payment-orders"];
  if (filters.status) parts.push(filters.status);
  if (filters.currency) parts.push(filters.currency.toLowerCase());
  if (filters.settlement) parts.push(filters.settlement);
  if (filters.q) parts.push("search");
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join("-")}.csv`;
}

/**
 * The row for a just-recorded order.
 *
 * Orders sort by creation date, so a new one lands at the top — but the ledger
 * may be filtered to somewhere it does not appear at all, and the tint is what
 * distinguishes "recorded, here it is" from "recorded, and now invisible".
 * It persists until dismissed rather than fading on a timer.
 */
export const ordersRowHighlightClassName =
  "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--admin-success)_16%,transparent)]";

export type OrderCheck = {
  key: string;
  label: string;
  status: "pass" | "fail";
  /** Why it matters, shown only when it fails. */
  detail: string;
};

type CheckableOrder = {
  externalId: string | null;
  amountCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

/**
 * The integrity checks a single order can be held to.
 *
 * Every one is derived from the row itself — nothing here asks a gateway or
 * invents a rule the data cannot support. A check that cannot be evaluated is
 * not listed at all, which is why there is no "payment method valid": the
 * ledger stores no payment method to validate.
 */
export function orderChecks(order: CheckableOrder): OrderCheck[] {
  const checks: OrderCheck[] = [];

  const hasExternalId = order.externalId !== null && order.externalId.trim() !== "";
  checks.push({
    key: "external-id",
    label: "External ID present",
    status: hasExternalId ? "pass" : "fail",
    detail:
      "Gateway webhooks find an order by its external ID. Without one, nothing can move this order out of its current status automatically.",
  });

  // `paid` and `paidAt` are written together by the webhook, so a row holding
  // one without the other was written by something that skipped a step.
  const paidAgrees = order.status === "paid" ? order.paidAt !== null : true;
  checks.push({
    key: "status-paid-at",
    label: "Status and paid-at agree",
    status: paidAgrees ? "pass" : "fail",
    detail: "This order is marked paid but carries no settlement time, so nobody can say when.",
  });

  const amountSane = Number.isInteger(order.amountCents) && order.amountCents >= 0;
  checks.push({
    key: "amount",
    label: "Amount is a non-negative whole number of minor units",
    status: amountSane ? "pass" : "fail",
    detail: "A fractional or negative minor-unit amount cannot be settled or reported on.",
  });

  // Only checkable when both timestamps exist; a pending order has nothing to
  // compare, and that is a pass rather than a silent omission.
  const sequenceSane = order.paidAt === null || new Date(order.paidAt) >= new Date(order.createdAt);
  checks.push({
    key: "timestamps",
    label: "Settled no earlier than it was created",
    status: sequenceSane ? "pass" : "fail",
    detail: "The settlement time precedes the order's creation, which should be impossible.",
  });

  return checks;
}

/**
 * Whether this order was written by hand rather than settled by a gateway.
 *
 * The record form stores the operator's reason under `manualEntryNote`, so its
 * presence is the one honest signal that a human wrote this row. Without it the
 * screen cannot claim a webhook settled anything — only that the row says paid.
 */
export function manualEntryNote(metadata: Record<string, unknown> | null): string | null {
  if (metadata === null) return null;
  const note = metadata["manualEntryNote"];
  return typeof note === "string" && note.trim() !== "" ? note : null;
}

/**
 * What each reconciliation fault is, and what an operator can actually do.
 *
 * Kept beside the fault enum rather than inline in the page, because the
 * remedies are the part most likely to be written as wishful thinking: there is
 * no "check with the gateway" button here, and the copy must not imply one.
 */
export const ORDER_FAULT_COPY: Record<
  PaymentOrderFault,
  { title: string; why: string; remedy: string }
> = {
  "missing-external-id": {
    title: "No external ID",
    why: "A gateway webhook finds an order by its external ID. Without one, nothing can move these orders out of their current status automatically — they will stay as they are indefinitely.",
    remedy:
      "Find the matching payment in your gateway's own dashboard by amount and time, then record a manual order carrying that external ID. Leave the original alone; orders are never edited or deleted here, so the audit trail survives.",
  },
  "stale-pending": {
    title: "Pending too long",
    why: "A checkout that was started and never completed leaves a pending order behind. Most are abandoned baskets, but a genuine payment whose webhook never arrived looks identical from here.",
    remedy:
      "Check the gateway for a settled payment with the same amount around the creation time. If one exists, the webhook did not arrive and the order needs recording by hand; if not, the checkout was abandoned and the row is harmless.",
  },
  "paid-without-timestamp": {
    title: "Paid without a settlement time",
    why: "These orders are marked paid but carry no settlement timestamp, so nobody can state when the money arrived. Every report that groups by settlement date treats them as settled on the day they were created.",
    remedy:
      "Written by something that skipped a step — usually a manual entry or a partial webhook. Confirm the real settlement date in your gateway before quoting any of these in a reconciliation.",
  },
};

/** Whole days between a timestamp and now; negative clock skew reads as 0. */
export function ageInDays(iso: string, now: number = Date.now()): number {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((now - created) / 86_400_000));
}

/**
 * Age as a worklist reads it.
 *
 * Days, not "2 months ago": the operator is comparing rows against a threshold
 * measured in days, and a rounded relative label hides which of two rows is
 * older.
 */
export function formatAge(iso: string, now: number = Date.now()): string {
  const days = ageInDays(iso, now);
  if (days === 0) return "today";
  return `${String(days)}d`;
}

/**
 * CSV of the reconciliation worklist.
 *
 * Carries the fault as its own column, because a file that mixes three
 * different reasons for being stuck without saying which is which is not
 * actionable — and the caller states in the UI when a group was sampled rather
 * than exported whole.
 */
export function unmatchedOrdersToCsv(
  groups: ReadonlyArray<{ fault: PaymentOrderFault; items: PaymentOrder[] }>,
  now: number = Date.now(),
): string {
  const headers = [
    "Fault",
    "Order ID",
    "External ID",
    "Membership ID",
    "Status",
    "Amount",
    "Currency",
    "Created",
    "Age (days)",
  ];
  return [
    csvRow(headers),
    ...groups.flatMap((group) =>
      group.items.map((order) =>
        csvRow([
          ORDER_FAULT_COPY[group.fault].title,
          order.id,
          order.externalId ?? "",
          order.membershipId ?? "",
          order.status,
          (order.amountCents / 100).toFixed(2),
          order.currency,
          order.createdAt,
          ageInDays(order.createdAt, now),
        ]),
      ),
    ),
  ].join("\r\n");
}
