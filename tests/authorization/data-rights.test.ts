import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function adminTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "data.export.run" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin" }]),
  };
}

function learnerTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "data.deletion.request" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

describe("data-rights authorization", () => {
  it("allows data.export.run for admin on tenant export catalog", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "data.export.run",
      resource: createTenantResourceRef({
        type: "export_job",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_export_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows data.deletion.request only for own membership", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "data.deletion.request",
      resource: createTenantResourceRef({
        type: "membership",
        id: "learner-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_deletion_self" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner deletion request for another membership", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "data.deletion.request",
      resource: createTenantResourceRef({
        type: "membership",
        id: "learner-b",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_deletion_other" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows data.deletion.manage for admin on deletion request resource", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "data.deletion.manage" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "admin" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "data.deletion.manage",
      resource: createTenantResourceRef({
        type: "deletion_request",
        id: "request-1",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_deletion_manage" },
    });

    expect(decision.allowed).toBe(true);
  });
});
