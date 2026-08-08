import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import {
  createAttributionTokenBodySchema,
  updateReadinessPolicyBodySchema,
} from "../../backend/apps/api/src/server/readiness/readiness.schemas";

function adminTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "readiness_policy.manage" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin" }]),
  };
}

function learnerReadTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "readiness_policy.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

function learnerWithoutManageTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "readiness_policy.manage" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]),
  };
}

describe("readiness authorization", () => {
  it("allows learner to read readiness policy", async () => {
    const decision = await can({
      tx: learnerReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "readiness_policy.read",
      resource: createTenantResourceRef({
        type: "readiness_policy",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows admin to manage readiness policy", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "readiness_policy.manage",
      resource: createTenantResourceRef({
        type: "readiness_policy",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner manage without role grant", async () => {
    const decision = await can({
      tx: learnerWithoutManageTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "readiness_policy.manage",
      resource: createTenantResourceRef({
        type: "readiness_policy",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("allows learner to mint own CTA token via readiness_policy.read", async () => {
    const decision = await can({
      tx: learnerReadTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "readiness_policy.read",
      resource: createTenantResourceRef({
        type: "readiness_policy",
        id: "tenant-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("rejects client tenant_id and targetUrl in schemas", () => {
    expect(() =>
      updateReadinessPolicyBodySchema.parse({
        scoringProfileId: "018f0000-0000-7000-8000-000000000001",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
        ctaPolicy: {
          outboundTargetUrl: "https://example.com/a",
          tokenTtlSeconds: 3600,
          bandProminenceRules: [{ bandKey: "ready", prominence: "standard" }],
          ctaCopy: { headline: "H", body: "B", buttonLabel: "Go" },
        },
        legalCopy: {
          disclaimer: "Educational only.",
          bandNotes: {},
          legalReviewChecklist: ["Reviewed"],
        },
      }),
    ).toThrow();

    expect(() =>
      createAttributionTokenBodySchema.parse({
        sourceSurface: "L12",
        sourcePath: "/readiness",
        targetUrl: "https://evil.example",
      }),
    ).toThrow();
  });
});
