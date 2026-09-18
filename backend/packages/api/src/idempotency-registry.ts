import { createHash } from "node:crypto";
import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * Framework-level idempotency for mutating tenant routes (audit finding M10).
 *
 * Before this, `requireIdempotencyKey` asserted the header was present and
 * nothing more. Deduplication depended on the handler happening to own a table
 * with `@@unique([tenant_id, idempotency_key])`. Measured: 188 routes declare
 * `idempotency: "required"`; 11 tables carry the column. Every other route
 * validated the header and then wrote twice on a replay — on the payment paths
 * included, where a retry after a client timeout is the ordinary case.
 *
 * The claim is made inside the same transaction as the handler, so the record
 * and the handler's writes commit or roll back together. A handler that throws
 * leaves no claim behind, and the client's retry is treated as a first attempt
 * rather than being permanently locked out by a poisoned key.
 *
 * Concurrency is resolved by the unique index, not by read-then-write: two
 * simultaneous retries both attempt the INSERT, exactly one wins, and the loser
 * gets a conflict it can act on.
 */

/** Postgres will not store a response larger than this; see `response_omitted`. */
const MAX_STORED_RESPONSE_BYTES = 256 * 1024;

export type IdempotencyTx = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

type ClaimRow = {
  id: string;
  status: string;
  request_fingerprint: string;
  response_json: unknown;
  response_omitted: boolean;
};

export function fingerprintRequest(input: { method: string; path: string; body: unknown }): string {
  // Key order in a parsed body is stable for a given handler, and the value has
  // already passed schema validation, so a plain stringify is a faithful
  // identity for "the same request" without needing a canonical-JSON pass.
  const payload = JSON.stringify({
    method: input.method.toUpperCase(),
    path: input.path,
    body: input.body ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function idempotencyKeyReused(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 422,
    message:
      "This Idempotency-Key was already used for a different request. Use a new key for a new operation.",
  });
}

export function idempotentRequestInFlight(): AtlasHttpError {
  return new AtlasHttpError({
    code: "IDEMPOTENCY_CONFLICT",
    status: 409,
    message: "A request with this Idempotency-Key is still in progress. Retry shortly.",
  });
}

export function idempotentReplayUnavailable(): AtlasHttpError {
  // Deliberately an error rather than a re-run. Re-running is the double write
  // this whole mechanism exists to prevent, so the honest answer is that the
  // original outcome cannot be replayed.
  return new AtlasHttpError({
    code: "IDEMPOTENCY_CONFLICT",
    status: 409,
    message:
      "This request already completed, but its response was too large to replay. Query the resource directly.",
  });
}

/**
 * Runs `handler` at most once per (tenant, idempotency key).
 *
 * Returns the stored response when the same key and the same request are seen
 * again; raises when the key is reused for a different request, or when a
 * concurrent attempt still holds the claim.
 */
export async function withIdempotency<T>(
  tx: IdempotencyTx,
  claim: {
    tenantId: string;
    idempotencyKey: string;
    scope: string;
    requestFingerprint: string;
    actorMembershipId?: string | undefined;
    requestId?: string | undefined;
  },
  handler: () => Promise<T>,
): Promise<T> {
  const inserted = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO idempotency_records (
      tenant_id, idempotency_key, scope, actor_membership_id, request_id, request_fingerprint, status
    )
    VALUES (
      ${claim.tenantId}::uuid,
      ${claim.idempotencyKey},
      ${claim.scope},
      ${claim.actorMembershipId ?? null}::uuid,
      ${claim.requestId ?? null},
      ${claim.requestFingerprint},
      'IN_PROGRESS'
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING id::text
  `;

  const claimedId = inserted[0]?.id;

  if (claimedId === undefined) {
    const rows = await tx.$queryRaw<ClaimRow[]>`
      SELECT id::text, status, request_fingerprint, response_json, response_omitted
      FROM idempotency_records
      WHERE tenant_id = ${claim.tenantId}::uuid
        AND idempotency_key = ${claim.idempotencyKey}
      LIMIT 1
    `;
    const existing = rows[0];

    // The row was deleted by the retention sweep between the failed insert and
    // this read. Treat it as a fresh request rather than failing on a race.
    if (!existing) {
      return handler();
    }

    if (existing.request_fingerprint !== claim.requestFingerprint) {
      throw idempotencyKeyReused();
    }

    if (existing.status !== "COMPLETED") {
      throw idempotentRequestInFlight();
    }

    if (existing.response_omitted) {
      throw idempotentReplayUnavailable();
    }

    return existing.response_json as T;
  }

  const result = await handler();

  const serialised = JSON.stringify(result);
  const omit = Buffer.byteLength(serialised, "utf8") > MAX_STORED_RESPONSE_BYTES;

  await tx.$executeRaw`
    UPDATE idempotency_records
       SET status = 'COMPLETED',
           completed_at = now(),
           response_json = ${omit ? null : serialised}::jsonb,
           response_omitted = ${omit}
     WHERE id = ${claimedId}::uuid
  `;

  return result;
}

/**
 * Retention sweep. Records exist to answer "did I already do this?" for as long
 * as a client might retry; keeping them longer is a growing table that stores
 * request and response bodies, which is a privacy cost as much as a storage one.
 */
export async function purgeExpiredIdempotencyRecords(tx: IdempotencyTx): Promise<number> {
  return tx.$executeRaw`
    DELETE FROM idempotency_records
     WHERE expires_at < now()
  `;
}
