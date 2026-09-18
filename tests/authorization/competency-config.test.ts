import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { createDimensionBodySchema } from "../../backend/apps/api/src/server/competency/competency-config.schemas";

function adminTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.dimension.manage" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin", bypasses_resource_predicates: true }]),
  };
}

function instructorReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.dimension.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor", bypasses_resource_predicates: false }]),
  };
}

function instructorWithoutManageTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "competency.dimension.manage" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  };
}

describe("competency config authorization", () => {
  it("allows tenant admin to manage dimensions", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "competency.dimension.manage",
      resource: createTenantResourceRef({
        type: "competency_config_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows instructor read on catalog", async () => {
    const decision = await can({
      tx: instructorReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "competency.dimension.read",
      resource: createTenantResourceRef({
        type: "competency_config_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies instructor manage without role grant", async () => {
    const decision = await can({
      tx: instructorWithoutManageTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "competency.dimension.manage",
      resource: createTenantResourceRef({
        type: "competency_config_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("rejects client tenant_id in mutation schema", () => {
    expect(() =>
      createDimensionBodySchema.parse({
        key: "focus",
        name: "Focus",
        tenantId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
