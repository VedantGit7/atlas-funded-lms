/**
 * The rules a refund form has to obey, in one place.
 *
 * There are two refund surfaces — the modal used from Transactions and Refunds,
 * and the standalone page under an order — and every one of these rules is the
 * server's rather than a screen's invention. Holding them in two components was
 * how one of them ended up gating "revoke access" on half the condition the
 * service actually checks.
 */

/** What the refund endpoint needs to know about the payment being reversed. */
export type RefundableTransaction = {
  membershipId: string | null;
  refundableAmountCents: number;
  canRefund: boolean;
  product: { courseId: string | null };
};

/**
 * Minor units from a typed major-unit amount.
 *
 * Pinned to two decimals before scaling: `124.99 * 100` is 12498.999… in binary
 * floating point, so rounding the raw product can quietly lose a minor unit off
 * a refund. Returns `NaN` for anything unparseable, which the validity check
 * below rejects.
 */
export function parseRefundAmountCents(input: string): number {
  const cleaned = input.replace(/,/g, "").trim();
  // `Number("")` is 0, not NaN. Returning 0 for an empty field would read as a
  // parsed zero-value refund to any caller that only checks `Number.isFinite`.
  if (cleaned === "") return Number.NaN;
  const major = Number(cleaned);
  if (!Number.isFinite(major)) return Number.NaN;
  return Math.round(Number(major.toFixed(2)) * 100);
}

/**
 * Whether an amount can be refunded against the remaining balance.
 *
 * The endpoint rejects anything above the refundable balance, so checking it
 * here keeps the failure on the field instead of in a round trip.
 */
export function isRefundAmountValid(amountCents: number, refundableCents: number): boolean {
  return Number.isFinite(amountCents) && amountCents > 0 && amountCents <= refundableCents;
}

/** A refund needs a settled payment with something left to reverse. */
export function isRefundable(transaction: RefundableTransaction): boolean {
  return transaction.canRefund && transaction.refundableAmountCents > 0;
}

/**
 * Why revoking course access is unavailable, or `null` when it is available.
 *
 * The service revokes only when the payment carries a course **and** a
 * membership. Offering the toggle otherwise lets an operator tick it and
 * believe access was pulled, when the server silently skipped it.
 */
export function revokeAccessBlockedReason(transaction: RefundableTransaction): string | null {
  if (transaction.product.courseId === null) return "No linked course on this payment";
  if (transaction.membershipId === null) return "No learner attached to this payment";
  return null;
}

/** The endpoint requires a note of 1–2000 characters. */
export const REFUND_NOTE_MAX = 2000;

export function isRefundNoteValid(note: string): boolean {
  const trimmed = note.trim();
  return trimmed.length > 0 && trimmed.length <= REFUND_NOTE_MAX;
}
