import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  type IdempotencyTx,
  idempotencyKeyReused,
  idempotentRequestInFlight,
  idempotentReplayUnavailable,
  validateIdempotencyKey,
} from "./idempotency-registry";

/** Called only inside an authorized platform transaction, after current MFA. */
export async function withPlatformIdempotency<T>(
  tx: IdempotencyTx,
  claim: {
    idempotencyKey: string;
    actorPrincipalId: string;
    scope: string;
    requestId: string;
    requestFingerprint: string;
  },
  handler: () => Promise<T>,
): Promise<T> {
  validateIdempotencyKey(claim.idempotencyKey);
  if (!claim.actorPrincipalId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Idempotency requires an authenticated actor.",
    });
  }
  const inserted = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO platform_idempotency_records (
      idempotency_key, actor_principal_id, scope, request_id, request_fingerprint
    ) VALUES (
      ${claim.idempotencyKey}, ${claim.actorPrincipalId}::uuid, ${claim.scope},
      ${claim.requestId}, ${claim.requestFingerprint}
    ) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id::text
  `;
  const claimedId = inserted[0]?.id;
  if (claimedId === undefined) {
    const rows = await tx.$queryRaw<
      Array<{
        actor_principal_id: string;
        scope: string;
        request_fingerprint: string;
        status: string;
        response_json: unknown;
        response_omitted: boolean;
        replay_valid: boolean;
      }>
    >`
      SELECT actor_principal_id::text, scope, request_fingerprint, status,
             response_json, response_omitted,
             (expires_at > statement_timestamp()) AS replay_valid
      FROM platform_idempotency_records WHERE idempotency_key = ${claim.idempotencyKey}
      LIMIT 1
    `;
    const existing = rows[0];
    if (!existing) throw idempotentRequestInFlight();
    if (
      existing.actor_principal_id !== claim.actorPrincipalId ||
      existing.scope !== claim.scope ||
      existing.request_fingerprint !== claim.requestFingerprint
    ) {
      throw idempotencyKeyReused();
    }
    if (!existing.replay_valid) {
      throw new AtlasHttpError({
        code: "IDEMPOTENCY_CONFLICT",
        status: 409,
        message:
          "The replay window has expired. Reconcile the operation's outcome before submitting another request.",
      });
    }
    if (existing.status !== "COMPLETED") throw idempotentRequestInFlight();
    if (existing.response_omitted) throw idempotentReplayUnavailable();
    return existing.response_json as T;
  }
  const result = await handler();
  const serialized = JSON.stringify(result);
  const omit = Buffer.byteLength(serialized, "utf8") > 256 * 1024;
  await tx.$executeRaw`
    UPDATE platform_idempotency_records SET status='COMPLETED', completed_at=now(),
      response_json=${omit ? null : serialized}::jsonb, response_omitted=${omit}
    WHERE id=${claimedId}::uuid
  `;
  return result;
}
