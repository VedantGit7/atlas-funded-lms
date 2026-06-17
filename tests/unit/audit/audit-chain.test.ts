import { describe, expect, it, vi } from "vitest";
import { verifyAuditHashChain } from "@atlas/audit/services/audit-chain.service";
import type { AuditDbTx } from "@atlas/audit/transaction";

describe("verifyAuditHashChain", () => {
  it("returns valid for a clean chain", async () => {
    const queryRawMock = vi.fn().mockResolvedValue([
      {
        checked: 12,
        valid: true,
        first_broken_audit_entry_id: null,
      },
    ]);
    const tx = { $queryRaw: queryRawMock } as unknown as AuditDbTx;

    await expect(
      verifyAuditHashChain(tx, { tenantId: "018f0000-0000-7000-8000-000000000001" }),
    ).resolves.toEqual({
      checked: 12,
      valid: true,
      firstBrokenAuditEntryId: null,
    });
  });

  it("detects a broken chain when the DB helper reports a broken row", async () => {
    const brokenId = "018f0000-0000-7000-8000-0000000000aa";
    const queryRawMock = vi.fn().mockResolvedValue([
      {
        checked: 8,
        valid: false,
        first_broken_audit_entry_id: brokenId,
      },
    ]);
    const tx = { $queryRaw: queryRawMock } as unknown as AuditDbTx;

    await expect(verifyAuditHashChain(tx)).resolves.toEqual({
      checked: 8,
      valid: false,
      firstBrokenAuditEntryId: brokenId,
    });
  });
});
