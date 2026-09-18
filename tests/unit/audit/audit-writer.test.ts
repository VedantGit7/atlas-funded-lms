import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertAuditEntryMock = vi.fn();

vi.mock("@atlas/audit/repositories/audit.repository", () => ({
  insertAuditEntry: (...args: unknown[]) => insertAuditEntryMock(...args),
}));

import { auditWriter } from "@atlas/audit/services/audit-writer";
import type { AuditDbTx } from "@atlas/audit/transaction";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const membershipId = "018f0000-0000-7000-8000-000000000002";
const platformPrincipalId = "018f0000-0000-7000-8000-000000000003";
const targetId = "018f0000-0000-7000-8000-000000000004";
const requestId = "req_audit_writer_test";

const tx = { $queryRaw: vi.fn() } as unknown as AuditDbTx;

const validInput = {
  action: "membership.status_changed",
  target: { type: "membership", id: targetId },
  before: { status: "ACTIVE" },
  after: { status: "SUSPENDED" },
  reason: "Policy violation",
  metadata: { source: "unit-test" },
};

describe("auditWriter", () => {
  beforeEach(() => {
    insertAuditEntryMock.mockReset();
    insertAuditEntryMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  it("validates input with Zod and rejects a missing action", async () => {
    await expect(
      auditWriter.write(
        tx,
        {
          tenantId,
          actorMembershipId: membershipId,
          platformPrincipalId: null,
          requestId,
        },
        {
          ...validInput,
          action: "",
        },
      ),
    ).rejects.toThrow();

    expect(insertAuditEntryMock).not.toHaveBeenCalled();
  });

  it("writes exactly one audit row", async () => {
    await auditWriter.write(
      tx,
      {
        tenantId,
        actorMembershipId: membershipId,
        platformPrincipalId: null,
        requestId,
      },
      validInput,
    );

    expect(insertAuditEntryMock).toHaveBeenCalledTimes(1);
  });

  it("includes requestId and tenantId for tenant-scoped writes", async () => {
    await auditWriter.write(
      tx,
      {
        tenantId,
        actorMembershipId: membershipId,
        platformPrincipalId: null,
        requestId,
      },
      validInput,
    );

    expect(insertAuditEntryMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        requestId,
      }),
      expect.objectContaining({
        action: validInput.action,
      }),
    );
  });

  it("includes platformPrincipalId for platform-scoped writes", async () => {
    await auditWriter.write(
      tx,
      {
        tenantId: null,
        actorMembershipId: null,
        platformPrincipalId,
        requestId,
      },
      {
        ...validInput,
        action: "platform.scope.enter",
      },
    );

    expect(insertAuditEntryMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId: null,
        actorMembershipId: null,
        platformPrincipalId,
        requestId,
      }),
      expect.objectContaining({
        action: "platform.scope.enter",
      }),
    );
  });
});

describe("audit repository immutability", () => {
  it("does not update or delete audit rows", () => {
    const repositorySource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/audit/src/repositories/audit.repository.ts",
      ),
      "utf8",
    );

    expect(repositorySource).toContain("INSERT INTO audit_entries");
    expect(repositorySource).not.toMatch(/\bUPDATE\b/i);
    expect(repositorySource).not.toMatch(/\bDELETE\b/i);
  });
});
