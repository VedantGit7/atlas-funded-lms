import type { AuditDbTx } from "@atlas/audit/transaction";
import { auditWriter } from "@atlas/audit";
import { assertApprovedEventType } from "../event-types";
import { findDeadLetterForReplay } from "../repositories/dead-letter.repository";
import { outbox } from "./outbox.service";

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

  const replay = await outbox.publish(tx, {
    ctx: {
      tenantId: deadLetter.tenant_id,
      actorMembershipId: null,
      requestId: ctx.requestId,
    },
    eventType: deadLetter.event_type,
    aggregateType: "dead_letter_event",
    aggregateId: input.deadLetterId,
    payload: deadLetter.payload_json,
    idempotencyKey: ctx.idempotencyKey,
  });

  return {
    replayedOutboxEventId: replay.id,
  };
}
