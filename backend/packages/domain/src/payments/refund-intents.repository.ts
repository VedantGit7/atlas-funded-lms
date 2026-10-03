import { randomUUID, createHash } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { paymentTransactionNotRefundable } from "../reports/payments-roster.errors";

export type RefundTx = Pick<TenantTx, "$queryRaw" | "$executeRaw">;
export type RefundState =
  | "requested"
  | "processing"
  | "pending"
  | "succeeded"
  | "failed"
  | "reconciliation_required"
  | "manual_adjustment";
export type RefundPayload = {
  mode: "full" | "partial";
  reason: string;
  note: string;
  revokeAccess: boolean;
  notifyLearner: boolean;
  actorMembershipId: string | null;
  membershipId: string | null;
  courseId: string | null;
  refundMethod: "gateway" | "manual_adjustment";
  manualReference?: string;
};
export type RefundIntent = {
  id: string;
  tenant_id: string;
  order_id: string;
  request_key: string;
  request_fingerprint: string;
  amount_cents: number;
  currency: string;
  gateway_key: string | null;
  gateway_id: string | null;
  external_id: string | null;
  status: RefundState;
  provider_refund_id: string | null;
  payload_json: RefundPayload;
  lease_token: string | null;
  lease_until: Date | null;
  attempts: number;
  next_attempt_at: Date;
  created_at: Date;
  updated_at: Date;
  last_error: string | null;
};
export const RESERVED_REFUND_STATES: readonly RefundState[] = [
  "requested",
  "processing",
  "pending",
  "reconciliation_required",
];
export function refundFingerprint(body: unknown, orderId: string, actorId: string | null): string {
  return createHash("sha256").update(JSON.stringify({ orderId, actorId, body })).digest("hex");
}
export async function lockRefundOrder(tx: RefundTx, orderId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payment_orders
    WHERE id=${orderId}::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid FOR UPDATE`;
  return rows.length === 1;
}
export async function listRefundIntents(tx: RefundTx, orderId: string): Promise<RefundIntent[]> {
  return tx.$queryRaw<RefundIntent[]>`SELECT * FROM payment_refund_intents
    WHERE order_id=${orderId}::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid ORDER BY created_at,id`;
}
export async function findRefundRequest(tx: RefundTx, key: string): Promise<RefundIntent | null> {
  const rows = await tx.$queryRaw<RefundIntent[]>`SELECT * FROM payment_refund_intents
    WHERE request_key=${key}::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid`;
  return rows[0] ?? null;
}
export async function listRefundIntentsForOrders(
  tx: RefundTx,
  orderIds: string[],
): Promise<RefundIntent[]> {
  if (orderIds.length === 0) return [];
  return tx.$queryRaw<RefundIntent[]>`SELECT * FROM payment_refund_intents
    WHERE tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND order_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(orderIds)}::jsonb)::uuid)
    ORDER BY created_at,id`;
}
export async function reserveRefund(
  tx: RefundTx,
  input: {
    tenantId: string;
    orderId: string;
    requestKey: string;
    fingerprint: string;
    amountCents: number;
    availableCents: number;
    currency: string;
    gatewayKey: string | null;
    gatewayId: string | null;
    externalId: string | null;
    payload: RefundPayload;
  },
): Promise<RefundIntent> {
  // Caller holds payment order lock through commit; permanent request identity
  // protects retries beyond the HTTP idempotency cache's expiry.
  const existing = await findRefundRequest(tx, input.requestKey);
  if (existing) {
    if (existing.request_fingerprint !== input.fingerprint || existing.order_id !== input.orderId)
      throw paymentTransactionNotRefundable(
        "This refund request ID was already used with different details.",
      );
    return existing;
  }
  if (
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > input.availableCents
  )
    throw paymentTransactionNotRefundable("Refund exceeds the unreserved payment balance.");
  const rows = await tx.$queryRaw<RefundIntent[]>`INSERT INTO payment_refund_intents
    (id,tenant_id,order_id,request_key,request_fingerprint,amount_cents,currency,gateway_key,gateway_id,external_id,status,payload_json)
    VALUES (${randomUUID()}::uuid,${input.tenantId}::uuid,${input.orderId}::uuid,${input.requestKey}::uuid,
    ${input.fingerprint},${input.amountCents},${input.currency.toUpperCase()},${input.gatewayKey},${input.gatewayId}::uuid,
    ${input.externalId},${input.payload.refundMethod === "manual_adjustment" ? "manual_adjustment" : "requested"},${JSON.stringify(input.payload)}::jsonb) RETURNING *`;
  const result = rows[0];
  if (!result) throw new Error("Refund reservation was not persisted");
  return result;
}
export async function claimRefund(
  tx: RefundTx,
): Promise<{ intent: RefundIntent; dispatch: boolean } | null> {
  const rows = await tx.$queryRaw<RefundIntent[]>`SELECT * FROM payment_refund_intents
    WHERE tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND status IN ('requested','processing','pending','reconciliation_required')
    AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())
    ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
  const current = rows[0];
  if (!current) return null;
  const updated = await tx.$queryRaw<RefundIntent[]>`UPDATE payment_refund_intents
    SET status='processing',lease_token=${randomUUID()}::uuid,lease_until=now()+interval '5 minutes',
    attempts=attempts+1,updated_at=now() WHERE id=${current.id}::uuid RETURNING *`;
  const intent = updated[0];
  if (!intent) throw new Error("Refund claim failed");
  return { intent, dispatch: current.status === "requested" };
}
export async function lockRefundIntent(tx: RefundTx, id: string): Promise<RefundIntent | null> {
  const rows = await tx.$queryRaw<RefundIntent[]>`SELECT * FROM payment_refund_intents
    WHERE id=${id}::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid FOR UPDATE`;
  return rows[0] ?? null;
}
export async function setRefundState(
  tx: RefundTx,
  intent: RefundIntent,
  status: RefundState,
  providerId: string | null,
  error: string | null,
): Promise<void> {
  await tx.$executeRaw`UPDATE payment_refund_intents SET status=${status},provider_refund_id=${providerId},
    last_error=${error},lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '5 minutes',updated_at=now()
    WHERE id=${intent.id}::uuid AND tenant_id=${intent.tenant_id}::uuid`;
}
