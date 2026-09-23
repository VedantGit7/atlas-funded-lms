import { randomUUID } from "node:crypto";
import type { EventsDbTx } from "../transaction";
import type { OutboxPollRow, OutboxSubscription } from "./outbox.repository";

export type DeliveryJob = {
  id: string;
  tenant_id: string | null;
  outbox_event_id: string;
  destination_key: string;
  status: string;
  attempt_count: number;
  cycle_attempt_count: number;
  max_attempts: number;
  lease_token: string | null;
  lease_until: Date | null;
  next_attempt_at: Date;
  last_dead_letter_id: string | null;
  replayed_dead_letter_id: string | null;
};
export type DeliveryClaim = {
  job: DeliveryJob;
  event: OutboxPollRow;
  recovered: boolean;
  exhausted: boolean;
};

/** Materialization is bounded and skips existing destinations, including terminal jobs. */
export async function materializeDeliveryJobs(
  tx: EventsDbTx,
  subscriptions: OutboxSubscription[],
  limit: number,
  maxAttempts: number,
): Promise<void> {
  if (subscriptions.length === 0) return;
  await tx.$queryRaw`INSERT INTO outbox_delivery_jobs(tenant_id,outbox_event_id,destination_key,max_attempts)
    SELECT o.tenant_id,o.id,s."destinationKey",${maxAttempts}
    FROM outbox_events o CROSS JOIN jsonb_to_recordset(${JSON.stringify(subscriptions)}::jsonb) AS s("eventType" text,"destinationKey" text)
    WHERE o.available_at <= now() AND o.event_type=s."eventType"
    AND NOT EXISTS(SELECT 1 FROM outbox_delivery_jobs j WHERE j.outbox_event_id=o.id AND j.destination_key=s."destinationKey")
    ORDER BY o.available_at,o.occurred_at,o.id,s."destinationKey" LIMIT ${limit}
    ON CONFLICT(outbox_event_id,destination_key) DO NOTHING RETURNING id`;
}

export async function claimDeliveryJob(
  tx: EventsDbTx,
  subscriptions: OutboxSubscription[],
): Promise<DeliveryClaim | null> {
  if (subscriptions.length === 0) return null;
  const rows = await tx.$queryRaw<DeliveryJob[]>`SELECT j.* FROM outbox_delivery_jobs j
    JOIN outbox_events o ON o.id=j.outbox_event_id
    WHERE j.status IN ('pending','retry','processing') AND j.next_attempt_at<=now()
    AND (j.lease_until IS NULL OR j.lease_until<now())
    AND EXISTS(SELECT 1 FROM jsonb_to_recordset(${JSON.stringify(subscriptions)}::jsonb) AS s("eventType" text,"destinationKey" text)
      WHERE s."eventType"=o.event_type AND s."destinationKey"=j.destination_key)
    ORDER BY j.next_attempt_at,j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`;
  const current = rows[0];
  if (!current) return null;
  const exhausted = current.cycle_attempt_count >= current.max_attempts;
  const claimed = await tx.$queryRaw<
    DeliveryJob[]
  >`UPDATE outbox_delivery_jobs SET status='processing',
    attempt_count=attempt_count+${exhausted ? 0 : 1},cycle_attempt_count=cycle_attempt_count+${exhausted ? 0 : 1},
    lease_token=${randomUUID()}::uuid,lease_until=now()+interval '5 minutes',updated_at=now()
    WHERE id=${current.id}::uuid RETURNING *`;
  const events = await tx.$queryRaw<
    OutboxPollRow[]
  >`SELECT * FROM outbox_events WHERE id=${current.outbox_event_id}::uuid`;
  const job = claimed[0],
    event = events[0];
  if (!job || !event) throw new Error("OUTBOX_CLAIM_MISSING_EVENT");
  return { job, event, recovered: current.status === "processing", exhausted };
}

export async function lockDeliveryJob(tx: EventsDbTx, id: string): Promise<DeliveryJob | null> {
  const rows = await tx.$queryRaw<
    DeliveryJob[]
  >`SELECT * FROM outbox_delivery_jobs WHERE id=${id}::uuid FOR UPDATE`;
  return rows[0] ?? null;
}

export async function renewDeliveryLease(tx: EventsDbTx, job: DeliveryJob): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`UPDATE outbox_delivery_jobs
    SET lease_until=now()+interval '5 minutes',updated_at=now()
    WHERE id=${job.id}::uuid AND lease_token=${job.lease_token}::uuid AND status='processing' RETURNING id`;
  return rows.length === 1;
}

export async function finishDeliveryJob(
  tx: EventsDbTx,
  job: DeliveryJob,
  args: { status: string; delayMs: number; errorCode: string | null; deadLetterId: string | null },
): Promise<void> {
  await tx.$queryRaw`UPDATE outbox_delivery_jobs SET status=${args.status},
    next_attempt_at=now()+${args.delayMs}*interval '1 millisecond',lease_token=NULL,lease_until=NULL,
    last_error_code=${args.errorCode},last_dead_letter_id=${args.deadLetterId}::uuid,updated_at=now()
    WHERE id=${job.id}::uuid AND lease_token=${job.lease_token}::uuid RETURNING id`;
}

/** Platform-authorized replay resets only this destination, never copies the event. */
export async function replayDeliveryJob(
  tx: EventsDbTx,
  input: { deadLetterId: string; outboxEventId: string; destinationKey: string },
): Promise<void> {
  const rows = await tx.$queryRaw<DeliveryJob[]>`SELECT * FROM outbox_delivery_jobs
    WHERE outbox_event_id=${input.outboxEventId}::uuid AND destination_key=${input.destinationKey} FOR UPDATE`;
  const job = rows[0];
  if (!job) throw new Error("DELIVERY_JOB_NOT_FOUND");
  if (job.replayed_dead_letter_id === input.deadLetterId) return;
  if (job.status === "reconciliation_required") throw new Error("DELIVERY_RECONCILIATION_REQUIRED");
  if (job.status !== "dead" || job.last_dead_letter_id !== input.deadLetterId)
    throw new Error("DEAD_LETTER_REPLAY_STALE");
  await tx.$queryRaw`UPDATE outbox_delivery_jobs SET status='pending',cycle_attempt_count=0,
    next_attempt_at=now(),lease_token=NULL,lease_until=NULL,last_error_code=NULL,
    replayed_dead_letter_id=${input.deadLetterId}::uuid,updated_at=now()
    WHERE id=${job.id}::uuid RETURNING id`;
}
