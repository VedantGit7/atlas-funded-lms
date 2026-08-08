import type { AuditDbTx } from "../transaction";

export type AuditChainVerificationResult = {
  checked: number;
  valid: boolean;
  firstBrokenAuditEntryId: string | null;
};

export async function verifyAuditHashChain(
  tx: AuditDbTx,
  args: {
    tenantId?: string | null;
    limit?: number;
  } = {},
): Promise<AuditChainVerificationResult> {
  const rows = await tx.$queryRaw<
    { checked: number; valid: boolean; first_broken_audit_entry_id: string | null }[]
  >`
    SELECT *
    FROM app.verify_audit_chain(${args.tenantId ?? null}, ${args.limit ?? 1000})
  `;

  const row = rows[0];

  return {
    checked: row?.checked ?? 0,
    valid: row?.valid ?? true,
    firstBrokenAuditEntryId: row?.first_broken_audit_entry_id ?? null,
  };
}
