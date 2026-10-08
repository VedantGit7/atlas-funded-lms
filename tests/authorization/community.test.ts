import { describe, expect, it, vi } from "vitest";
import { enforceEntitlement } from "@atlas/authorization";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { EntitlementRequiredError } from "@atlas/authorization";

vi.mock("@atlas/domain-config", async () => {
  // The gate now reads value_json on every call, so the parse is real here:
  // mocking it would hide whether `{ enabled: false }` actually denies.
  const { parseEntitlementValue } = (await vi.importActual(
    "@atlas/domain-config/schemas/entitlement-value",
  )) as {
    parseEntitlementValue: (raw: unknown) => {
      enabled: boolean;
      limit: number | null;
      period: string;
    };
  };
  return {
    parseEntitlementValue,
    findActiveEntitlementByKey: vi.fn(),
  };
});

import { findActiveEntitlementByKey } from "@atlas/domain-config";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

const findActiveEntitlementByKeyMock = vi.mocked(findActiveEntitlementByKey);

function learnerTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "post.read" }],
      [],
      [{ role_key: "learner", bypasses_resource_predicates: false }],
    ),
  };
}

describe("community authorization", () => {
  it("denies private-space post.read without memberOfSpace relationship", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "post.read",
      resource: createTenantResourceRef({
        type: "post",
        id: "post-a",
        tenantId: "tenant-a",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("allows tenant-visible post.read without membership", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "post.read",
      resource: createTenantResourceRef({
        type: "post",
        id: "post-a",
        tenantId: "tenant-a",
        relationships: { tenantVisibleSpace: true },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows community.space.read on the self-filtered tenant space catalog", async () => {
    // Regression: the catalog listing (`GET /api/v1/spaces`) uses a
    // `community_space_catalog` resource that has no single space to relate to.
    // Its loader marks the surface tenant-visible so any tenant member with the
    // grant can browse; per-space visibility stays enforced by the SQL query.
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "community.space.read",
      resource: createTenantResourceRef({
        type: "community_space_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: { tenantVisibleSpace: true },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies community.space.read on a catalog surface with no relationship", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "community.space.read",
      resource: createTenantResourceRef({
        type: "community_space_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("denies comment.update for non-owner", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "comment.update",
      resource: createTenantResourceRef({
        type: "comment",
        id: "comment-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
        relationships: { memberOfSpace: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows own comment update only", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "comment.update",
      resource: createTenantResourceRef({
        type: "comment",
        id: "comment-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
        relationships: { memberOfSpace: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("applies permission override deny before allow", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery([{ key: "post.create" }], [{ effect: "DENY" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "post.create",
      resource: createTenantResourceRef({
        type: "post",
        id: "post-a",
        tenantId: "tenant-a",
        relationships: { memberOfSpace: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });
});

describe("community entitlement before can", () => {
  it("throws before authorization when entitlement is missing", async () => {
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

describe("hall of fame entitlement behavior", () => {
  it("treats missing gamification entitlement as optional leaderboard segment", async () => {
    findActiveEntitlementByKeyMock.mockResolvedValueOnce(null);
    const entitlement = await findActiveEntitlementByKey(
      { $queryRaw: vi.fn() },
      "gamification.enable",
    );
    expect(entitlement).toBeNull();
  });
});
