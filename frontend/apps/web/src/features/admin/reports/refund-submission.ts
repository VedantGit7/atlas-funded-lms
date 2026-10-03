import { createUuid } from "../../../lib/create-uuid";

export type RefundStatus =
  | "requested"
  | "processing"
  | "pending"
  | "succeeded"
  | "failed"
  | "reconciliation_required"
  | "manual_adjustment"
  | "legacy_recorded";

export type RefundRequestIdentity = { fingerprint: string; refundRequestId: string };

export function refundBalanceLabel(balance: {
  amountCents: number;
  refundedAmountCents: number;
  reservedRefundAmountCents: number;
  refundableAmountCents: number;
}): string {
  if (balance.amountCents > 0 && balance.refundedAmountCents >= balance.amountCents)
    return "Fully refunded";
  if (balance.refundedAmountCents > 0) return "Partially refunded";
  if (balance.reservedRefundAmountCents > 0) return "Balance reserved";
  return balance.refundableAmountCents > 0 ? "Refundable" : "No available balance";
}

/** Keep the identity after a network error; an edited payload starts a new request. */
export function refundRequestIdentity(
  previous: RefundRequestIdentity | null,
  payload: object,
): RefundRequestIdentity {
  const fingerprint = JSON.stringify(payload);
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, refundRequestId: createUuid() };
}

export function refundOutcomeTitle(status: RefundStatus): string {
  switch (status) {
    case "succeeded":
      return "Refund confirmed by the gateway";
    case "manual_adjustment":
      return "Manual adjustment recorded — no money sent";
    case "failed":
      return "Refund failed — no refund confirmed";
    case "reconciliation_required":
      return "Refund requires reconciliation — confirmation unavailable";
    case "legacy_recorded":
      return "Legacy refund record — gateway confirmation unavailable";
    default:
      return "Refund requested — awaiting gateway confirmation";
  }
}
