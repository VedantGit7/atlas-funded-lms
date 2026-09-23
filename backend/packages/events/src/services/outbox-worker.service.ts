import { createHash } from "node:crypto";
import type { EventsDbTx } from "../transaction";
import {
  materializeDeliveryJobs,
  claimDeliveryJob,
  lockDeliveryJob,
  finishDeliveryJob,
  renewDeliveryLease,
  type DeliveryClaim,
} from "../repositories/outbox-job.repository";
import { insertEventDeliveryAttempt } from "../repositories/event-delivery.repository";
import { insertDeadLetterEvent } from "../repositories/dead-letter.repository";

export type DeliveryFailureKind = "retryable" | "permanent" | "reconciliation_required";
export class OutboxDeliveryError extends Error {
  readonly code: string;
  constructor(
    readonly kind: DeliveryFailureKind,
    code: string,
  ) {
    const safeCode = /^[A-Z0-9_]{1,80}$/.test(code) ? code : "DELIVERY_FAILED";
    super(safeCode);
    this.name = "OutboxDeliveryError";
    this.code = safeCode;
  }
}
export type OutboxHandler = {
  destinationKey: string;
  /** False for effects such as SMTP without provider-side deduplication. */
  retryOnCrash?: boolean;
  handle: (event: {
    id: string;
    eventType: string;
    tenantId: string | null;
    payload: unknown;
    requestId: string;
    idempotencyKey: string;
    attempt: number;
  }) => Promise<void>;
};
export type OutboxTransactions = { transaction<T>(fn: (tx: EventsDbTx) => Promise<T>): Promise<T> };
export function deliveryIdempotencyKey(eventId: string, destinationKey: string): string {
  return (
    "atlas-delivery-" +
    createHash("sha256")
      .update(JSON.stringify([eventId, destinationKey]))
      .digest("hex")
  );
}
export function retryDelayMs(attempt: number, random = Math.random): number {
  const cap = Math.min(3_600_000, 5_000 * 2 ** Math.min(Math.max(0, attempt - 1), 10));
  return Math.round(cap * (0.5 + Math.max(0, Math.min(1, random())) * 0.5));
}
function classify(error: unknown): OutboxDeliveryError {
  if (error instanceof OutboxDeliveryError) return error;
  if (error instanceof Error && error.name === "ZodError")
    return new OutboxDeliveryError("permanent", "INVALID_EVENT_PAYLOAD");
  return new OutboxDeliveryError("retryable", "HANDLER_FAILED");
}
async function recordOutcome(
  tx: EventsDbTx,
  claim: DeliveryClaim,
  error: OutboxDeliveryError | null,
  requestId: string,
): Promise<boolean> {
  const job = await lockDeliveryJob(tx, claim.job.id);
  if (!job || job.status !== "processing" || job.lease_token !== claim.job.lease_token)
    return false;
  const held = error?.kind === "reconciliation_required";
  const terminal = Boolean(
    error && (error.kind !== "retryable" || job.cycle_attempt_count >= job.max_attempts),
  );
  let deadLetterId: string | null = null;
  // An expired final claim has no acknowledged outcome, so its attempt is still appended once.
  await insertEventDeliveryAttempt(tx, {
    tenantId: claim.event.tenant_id,
    outboxEventId: claim.event.id,
    destinationKey: job.destination_key,
    attemptCount: job.attempt_count,
    status: error ? "FAILED" : "SUCCEEDED",
    requestId,
    ...(error
      ? {
          errorCode: error.code,
          safeErrorMessage: held
            ? "Delivery outcome requires operator reconciliation."
            : "Delivery failed; inspect the destination and retry policy.",
        }
      : {}),
  });
  if (terminal && error) {
    const dead = await insertDeadLetterEvent(tx, {
      tenantId: claim.event.tenant_id,
      outboxEventId: claim.event.id,
      destinationKey: job.destination_key,
      eventType: claim.event.event_type,
      errorCode: error.code,
      safeErrorMessage: held
        ? "Delivery outcome requires operator reconciliation."
        : "Delivery stopped after a permanent failure or exhausted retry budget.",
      retryCount: Math.max(0, job.cycle_attempt_count - 1),
      requestId,
      payloadJson: claim.event.payload_json,
    });
    deadLetterId = dead.id;
  }
  await finishDeliveryJob(tx, job, {
    status: !error ? "succeeded" : held ? "reconciliation_required" : terminal ? "dead" : "retry",
    delayMs: error && !terminal ? retryDelayMs(job.cycle_attempt_count) : 0,
    errorCode: error?.code ?? null,
    deadLetterId,
  });
  return true;
}

/** Claims and outcomes commit separately. No transaction is held while a handler runs. */
export async function processOutboxBatch(
  db: OutboxTransactions,
  args: { limit: number; handlers: Record<string, OutboxHandler[]>; maxRetries: number },
) {
  if (!Number.isInteger(args.maxRetries) || args.maxRetries < 0 || args.maxRetries > 100)
    throw new Error("INVALID_OUTBOX_RETRY_BUDGET");
  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 1000)
    throw new Error("INVALID_OUTBOX_BATCH_LIMIT");
  const subscriptions = Object.entries(args.handlers).flatMap(([eventType, handlers]) =>
    handlers.map((handler) => ({ eventType, destinationKey: handler.destinationKey })),
  );
  const identities = new Set(subscriptions.map((item) => JSON.stringify(item)));
  if (identities.size !== subscriptions.length) throw new Error("DUPLICATE_OUTBOX_DESTINATION");
  const counts = { processed: 0, delivered: 0, failed: 0, skipped: 0 };
  if (subscriptions.length === 0) return counts;
  await db.transaction((tx) =>
    materializeDeliveryJobs(tx, subscriptions, args.limit, args.maxRetries + 1),
  );
  for (let index = 0; index < args.limit; index++) {
    const claim = await db.transaction((tx) => claimDeliveryJob(tx, subscriptions));
    if (!claim) break;
    const handler = args.handlers[claim.event.event_type]?.find(
      (item) => item.destinationKey === claim.job.destination_key,
    );
    const metadata = claim.event.metadata_json as { requestId?: unknown } | null;
    const requestId = typeof metadata?.requestId === "string" ? metadata.requestId : "unknown";
    let failure: OutboxDeliveryError | null = null;
    if (claim.recovered && handler?.retryOnCrash === false)
      failure = new OutboxDeliveryError("reconciliation_required", "DELIVERY_INTERRUPTED");
    else if (claim.exhausted)
      failure = new OutboxDeliveryError("permanent", "RETRY_BUDGET_EXHAUSTED");
    else if (!handler) failure = new OutboxDeliveryError("permanent", "HANDLER_UNAVAILABLE");
    else {
      let renewal: Promise<void> | undefined;
      const heartbeat = setInterval(() => {
        if (renewal) return;
        // Failed renewal leaves the original lease intact. Outcome writes are
        // token-fenced, and expired non-idempotent claims require reconciliation.
        renewal = db
          .transaction((tx) => renewDeliveryLease(tx, claim.job))
          .then(
            () => {},
            () => {},
          )
          .finally(() => {
            renewal = undefined;
          });
      }, 60_000);
      heartbeat.unref();
      try {
        await handler.handle({
          id: claim.event.id,
          eventType: claim.event.event_type,
          tenantId: claim.event.tenant_id,
          payload: claim.event.payload_json,
          requestId,
          idempotencyKey: deliveryIdempotencyKey(claim.event.id, handler.destinationKey),
          attempt: claim.job.attempt_count,
        });
      } catch (error) {
        failure = classify(error);
      } finally {
        clearInterval(heartbeat);
        await renewal;
      }
    }
    // A result-commit failure is not a handler failure: leave the lease for recovery.
    const recorded = await db.transaction((tx) => recordOutcome(tx, claim, failure, requestId));
    counts.processed++;
    if (!recorded) counts.skipped++;
    else if (failure) counts.failed++;
    else counts.delivered++;
  }
  return counts;
}
