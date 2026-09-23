import type { RefundResult, PaymentProvider } from "./payment-provider";
import { paymentsRosterRepository } from "../reports/payments-roster.repository";
import {
  claimRefund,
  lockRefundOrder,
  lockRefundIntent,
  setRefundState,
  type RefundIntent,
  type RefundTx,
} from "./refund-intents.repository";
import type { TenantTx } from "@atlas/db";

export function refundPublicRecord(intent: RefundIntent, accessRevoked = false) {
  return {
    id: intent.id,
    amountCents: intent.amount_cents,
    reason: intent.payload_json.reason,
    note: intent.payload_json.note,
    mode: intent.payload_json.mode,
    revokeAccess: intent.payload_json.revokeAccess,
    notifyLearner: intent.payload_json.notifyLearner,
    accessRevoked,
    notifyQueued: false,
    actorMembershipId: intent.payload_json.actorMembershipId,
    createdAt: intent.created_at.toISOString(),
    status: intent.status,
    fulfillment: intent.payload_json.refundMethod,
    ...(intent.provider_refund_id ? { gatewayRefundId: intent.provider_refund_id } : {}),
  };
}

/** Caller locks order first. Ledger and requested access effects commit together. */
export async function applyRefundLedger(tx: RefundTx, intent: RefundIntent): Promise<boolean> {
  const rows = await tx.$queryRaw<
    { amount_cents: number; metadata_json: Record<string, unknown> | null }[]
  >`
    SELECT amount_cents,metadata_json FROM payment_orders WHERE id=${intent.order_id}::uuid
    AND tenant_id=${intent.tenant_id}::uuid FOR UPDATE`;
  const order = rows[0];
  if (!order) throw new Error("Refund order missing");
  const metadata = order.metadata_json ?? {};
  const refunds: Array<Record<string, unknown>> = Array.isArray(metadata["refunds"])
    ? (metadata["refunds"] as Array<Record<string, unknown>>)
    : [];
  const prior = refunds.find((item) => item["id"] === intent.id);
  if (prior) return prior["accessRevoked"] === true;
  let accessRevoked = false;
  if (
    intent.payload_json.revokeAccess &&
    intent.payload_json.membershipId &&
    intent.payload_json.courseId
  ) {
    accessRevoked = await paymentsRosterRepository.revokeCourseEnrollment(tx as TenantTx, {
      membershipId: intent.payload_json.membershipId,
      courseId: intent.payload_json.courseId,
    });
  }
  const next = [...refunds, refundPublicRecord(intent, accessRevoked)];
  const total = next.reduce(
    (sum, item) =>
      sum +
      (typeof item["amountCents"] === "number" && item["amountCents"] > 0
        ? item["amountCents"]
        : 0),
    0,
  );
  await tx.$executeRaw`UPDATE payment_orders SET metadata_json=${JSON.stringify({ ...metadata, refunds: next })}::jsonb,
    status=CASE WHEN ${total} >= amount_cents THEN 'refunded' ELSE status END,updated_at=now()
    WHERE id=${intent.order_id}::uuid AND tenant_id=${intent.tenant_id}::uuid`;
  return accessRevoked;
}

/** Returns false for stale claims/replayed terminal callbacks. Never trusts a raw URL/body. */
export async function recordRefundOutcome(
  tx: RefundTx,
  snapshot: RefundIntent,
  result: RefundResult | null,
  options: { leaseToken?: string; error?: string } = {},
): Promise<boolean> {
  if (!(await lockRefundOrder(tx, snapshot.order_id))) return false;
  const current = await lockRefundIntent(tx, snapshot.id);
  if (!current || ["succeeded", "manual_adjustment", "failed"].includes(current.status))
    return false;
  if (options.leaseToken && current.lease_token !== options.leaseToken) return false;
  const valid =
    result &&
    result.refundId &&
    result.intentId === current.id &&
    result.amountCents === current.amount_cents &&
    result.currency.toUpperCase() === current.currency.toUpperCase() &&
    result.externalId === current.external_id &&
    (!current.provider_refund_id || current.provider_refund_id === result.refundId);
  if (!valid) {
    await setRefundState(
      tx,
      current,
      "reconciliation_required",
      current.provider_refund_id,
      options.error ?? "Provider result requires reconciliation",
    );
    return true;
  }
  const status = result.status;
  await setRefundState(tx, current, status, result.refundId, null);
  if (status === "succeeded")
    await applyRefundLedger(tx, { ...current, status, provider_refund_id: result.refundId });
  return true;
}

export async function recordRefundWebhook(
  tx: RefundTx,
  gatewayKey: string,
  gatewayId: string,
  result: RefundResult,
): Promise<{ updated: boolean; orderId: string | null }> {
  const rows = await tx.$queryRaw<RefundIntent[]>`SELECT * FROM payment_refund_intents
    WHERE tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND gateway_key=${gatewayKey} AND gateway_id=${gatewayId}::uuid
    AND (id::text=${result.intentId} OR provider_refund_id=${result.refundId}) LIMIT 1`;
  const intent = rows[0];
  if (!intent) return { updated: false, orderId: null };
  // Provider metadata is editable. A signed callback only wakes reconciliation;
  // the original gateway must independently verify the real payment ownership.
  const updated =
    await tx.$executeRaw`UPDATE payment_refund_intents SET next_attempt_at=now(),updated_at=now()
    WHERE id=${intent.id}::uuid AND tenant_id=${intent.tenant_id}::uuid
    AND status IN ('processing','pending','reconciliation_required')`;
  return { updated: updated > 0, orderId: intent.order_id };
}

export type RefundDependencies = {
  transaction<T>(fn: (tx: RefundTx) => Promise<T>): Promise<T>;
  resolveProvider(
    tx: RefundTx,
    intent: RefundIntent,
  ): Promise<{ provider: PaymentProvider; gatewayId: string; gatewayKey: string }>;
};

/** Money movement is strictly between committed claim and outcome transactions. */
export async function processOneRefund(deps: RefundDependencies): Promise<"empty" | "handled"> {
  const work = await deps.transaction(async (tx) => {
    const claim = await claimRefund(tx);
    if (!claim) return null;
    try {
      return { ...claim, resolved: await deps.resolveProvider(tx, claim.intent) };
    } catch {
      return { ...claim, resolved: null };
    }
  });
  if (!work) return "empty";
  const { intent, resolved, dispatch } = work;
  let result: RefundResult | null = null;
  let error = "Provider outcome is unknown; do not submit another refund";
  try {
    if (
      !resolved ||
      resolved.gatewayId !== intent.gateway_id ||
      resolved.gatewayKey !== intent.gateway_key ||
      !intent.external_id
    )
      error = "Original payment gateway configuration is unavailable or changed";
    else if (dispatch) {
      result = await resolved.provider.refund({
        externalId: intent.external_id,
        amountCents: intent.amount_cents,
        intentId: intent.id,
        idempotencyKey: `atlas-refund-${intent.id}`,
      });
    } else if (resolved.provider.findRefund) {
      result = await resolved.provider.findRefund({
        externalId: intent.external_id,
        intentId: intent.id,
        refundId: intent.provider_refund_id,
      });
    }
  } catch {
    /* No raw gateway messages/credentials in stored failures. Never blind retry. */
  }
  await deps.transaction((tx) =>
    recordRefundOutcome(tx, intent, result, {
      ...(intent.lease_token ? { leaseToken: intent.lease_token } : {}),
      error,
    }),
  );
  return "handled";
}
