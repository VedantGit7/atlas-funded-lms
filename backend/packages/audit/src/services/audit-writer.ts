import { isSystemActor } from "@atlas/core/actor/system-actor";
import type { AuditDbTx } from "../transaction";
import { AuditWriteInputSchema, type AuditWriteInput } from "../schemas/audit";
import { insertAuditEntry, type AuditActorContext } from "../repositories/audit.repository";

/**
 * Write one audit entry.
 *
 * Un-attributable requests (payment and Zoom webhooks, public marketing
 * actions) carry `SYSTEM_ACTOR_MEMBERSHIP_ID` rather than a member. Those are
 * persisted with `actor_membership_id = NULL` and the originating system in
 * `metadata_json.systemSource`, because the column is a foreign-key-shaped
 * reference and storing a sentinel there would be the same category of lie as
 * the tenant id it replaced (M16): a value that looks like a membership and
 * joins to nothing.
 */
export async function writeAuditEntry(
  tx: AuditDbTx,
  ctx: AuditActorContext & { systemSource?: string },
  input: AuditWriteInput,
): Promise<{ id: string }> {
  const parsed = AuditWriteInputSchema.parse(input);

  if (!isSystemActor(ctx.actorMembershipId)) {
    return insertAuditEntry(tx, ctx, parsed);
  }

  return insertAuditEntry(
    tx,
    { ...ctx, actorMembershipId: null },
    {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        systemSource: ctx.systemSource ?? "unspecified",
      },
    },
  );
}

export const auditWriter = {
  write: writeAuditEntry,
};
