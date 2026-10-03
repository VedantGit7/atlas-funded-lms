import type { AuditDbTx } from "@atlas/audit/transaction";
import { auditWriter } from "@atlas/audit";
import { assertApprovedEventType } from "../event-types";
import { findDeadLetterForReplay } from "../repositories/dead-letter.repository";
import { replayDeliveryJob } from "../repositories/outbox-job.repository";

export async function replayDeadLetterEvent(
  tx: AuditDbTx,
  ctx: {
    platformPrincipalId: string;
    requestId: string;
    reason: string;
    idempotencyKey: string;
  },
  input: {
    deadLetterId: string;
  },
): Promise<{ replayedOutboxEventId: string }> {
  const deadLetter = await findDeadLetterForReplay(tx, input.deadLetterId);

  if (!deadLetter) {
    throw new Error("DEAD_LETTER_NOT_FOUND");
  }

  assertApprovedEventType(deadLetter.event_type);
  if (!deadLetter.destination_key) throw new Error("DEAD_LETTER_DESTINATION_REQUIRED");
  await replayDeliveryJob(tx, {
    deadLetterId: deadLetter.id,
    outboxEventId: deadLetter.outbox_event_id,
    destinationKey: deadLetter.destination_key,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: deadLetter.tenant_id,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "outbox.dead_letter.replayed",
      target: {
        type: "dead_letter_event",
        id: input.deadLetterId,
      },
      before: null,
      after: {
        originalOutboxEventId: deadLetter.outbox_event_id,
        eventType: deadLetter.event_type,
      },
      reason: ctx.reason,
      metadata: {
        replayRequestId: ctx.requestId,
      },
    },
  );

  return {
    replayedOutboxEventId: deadLetter.outbox_event_id,
  };
}
