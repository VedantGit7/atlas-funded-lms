import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function instructorTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "item.create" }],
      [],
      [{ role_key: "instructor", bypasses_resource_predicates: false }],
    ),
  };
}

function learnerWithoutItemCreateTx() {
  return {
    $queryRaw: authorizationFactsQuery([{ key: "item.create" }], [], []),
  };
}

describe("item registry authorization", () => {
  it("allows instructor item.create", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "item.create",
      resource: createTenantResourceRef({
        type: "item",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_item_create" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner item.create without role grant", async () => {
    const decision = await can({
      tx: learnerWithoutItemCreateTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "item.create",
      resource: createTenantResourceRef({
        type: "item",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_item_create_denied" },
    });

    expect(decision.allowed).toBe(false);
  });

  it("denies item.update for non-owner instructor", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "item.update",
      resource: createTenantResourceRef({
        type: "item",
        id: "item-b",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_item_update_denied" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OWNERSHIP_REQUIRED");
  });

  it("allows owner item.update", async () => {
    const decision = await can({
      tx: instructorTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "item.update",
      resource: createTenantResourceRef({
        type: "item",
        id: "item-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_item_update_allowed" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies learner extension.registration.manage", async () => {
    const decision = await can({
      tx: learnerWithoutItemCreateTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "extension.registration.manage",
      resource: createTenantResourceRef({
        type: "extension_registration",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_extension_manage_denied" },
    });

    expect(decision.allowed).toBe(false);
  });
});
