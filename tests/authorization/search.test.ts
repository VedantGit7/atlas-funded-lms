import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function learnerTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "search.query" }],
      [],
      [{ role_key: "learner", bypasses_resource_predicates: false }],
    ),
  };
}

function adminTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "search.reindex.manage" }],
      [],
      [{ role_key: "admin", bypasses_resource_predicates: true }],
    ),
  };
}

describe("search authorization", () => {
  it("allows search.query on tenant search catalog", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "search.query",
      resource: createTenantResourceRef({
        type: "search_index_entry",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_search_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows search.reindex.manage for admin role grants", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "search.reindex.manage",
      resource: createTenantResourceRef({
        type: "search_index_entry",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_search_reindex_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies search.reindex.manage for learner grants", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery(
        [],
        [],
        [{ role_key: "learner", bypasses_resource_predicates: false }],
      ),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "search.reindex.manage",
      resource: createTenantResourceRef({
        type: "search_index_entry",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_search_reindex_denied" },
    });

    expect(decision.allowed).toBe(false);
  });

  it("applies permission override deny before allow", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery([{ key: "search.query" }], [{ effect: "DENY" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "search.query",
      resource: createTenantResourceRef({
        type: "search_index_entry",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_search_override" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });
});
