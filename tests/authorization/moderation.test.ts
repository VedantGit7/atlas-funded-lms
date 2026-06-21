import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef, enforceEntitlement } from "@atlas/authorization";
import { EntitlementRequiredError } from "@atlas/authorization";

vi.mock("@atlas/domain-config", () => ({
  findActiveEntitlementByKey: vi.fn(),
}));

import { findActiveEntitlementByKey } from "@atlas/domain-config";

const findActiveEntitlementByKeyMock = vi.mocked(findActiveEntitlementByKey);

function moderatorTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "community.moderate" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "moderator" }]),
  };
}

describe("moderation authorization", () => {
  it("denies community.moderate without moderatorOfSpace relationship", async () => {
    const decision = await can({
      tx: moderatorTx(),
      actor: { tenantId: "tenant-a", membershipId: "moderator-a" },
      permission: "community.moderate",
      resource: createTenantResourceRef({
        type: "moderation_case_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("allows community.moderate for tenant-wide admin bypass", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "community.moderate" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "admin" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "community.moderate",
      resource: createTenantResourceRef({
        type: "moderation_case_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows post.delete for moderator relationship without ownership", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "post.delete" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "moderator" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "moderator-a" },
      permission: "post.delete",
      resource: createTenantResourceRef({
        type: "post",
        id: "post-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
        relationships: { moderatorOfSpace: "moderator-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies comment.update for non-owner even with moderate relationship", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "comment.update" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "moderator" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "moderator-a" },
      permission: "comment.update",
      resource: createTenantResourceRef({
        type: "comment",
        id: "comment-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
        relationships: { moderatorOfSpace: "moderator-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows appeal.create only for target author ownership", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "appeal.create" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ role_key: "learner" }]),
    };

    const allowed = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "appeal.create",
      resource: createTenantResourceRef({
        type: "appeal",
        id: "case-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(allowed.allowed).toBe(true);
  });

  it("applies explicit deny override before allow", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "appeal.review" }])
        .mockResolvedValueOnce([{ effect: "DENY" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "moderator-a" },
      permission: "appeal.review",
      resource: createTenantResourceRef({
        type: "appeal",
        id: "appeal-a",
        tenantId: "tenant-a",
        relationships: { moderatorOfSpace: "moderator-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });
});

describe("moderation entitlement before can", () => {
  it("throws when community.enable is missing", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValueOnce(null);

    await expect(
      enforceEntitlement(
        { $queryRaw: vi.fn() },
        {
          tenantId: "tenant-a",
          key: "community.enable",
          requestId: "req_entitlement",
        },
      ),
    ).rejects.toBeInstanceOf(EntitlementRequiredError);
  });
});
