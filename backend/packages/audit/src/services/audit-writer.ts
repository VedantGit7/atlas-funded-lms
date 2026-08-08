import type { AuditDbTx } from "../transaction";
import { AuditWriteInputSchema, type AuditWriteInput } from "../schemas/audit";
import { insertAuditEntry, type AuditActorContext } from "../repositories/audit.repository";

export async function writeAuditEntry(
  tx: AuditDbTx,
  ctx: AuditActorContext,
  input: AuditWriteInput,
): Promise<{ id: string }> {
  const parsed = AuditWriteInputSchema.parse(input);

  return insertAuditEntry(tx, ctx, parsed);
}

export const auditWriter = {
  write: writeAuditEntry,
};
