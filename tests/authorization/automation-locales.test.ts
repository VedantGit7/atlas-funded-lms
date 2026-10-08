import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function adminAutomationTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "automation.rule.manage" }],
      [],
      [{ role_key: "admin", bypasses_resource_predicates: true }],
    ),
  };
}

function instructorAutomationTx() {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "automation.rule.read" }],
      [],
      [{ role_key: "instructor", bypasses_resource_predicates: false }],
    ),
  };
}

describe("automation and locale authorization", () => {
  it("allows admin automation manage", async () => {
    const decision = await can({
      tx: adminAutomationTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "automation.rule.manage",
      resource: createTenantResourceRef({
        type: "automation_rule_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_automation" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("allows instructor automation read only", async () => {
    const decision = await can({
      tx: instructorAutomationTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "automation.rule.read",
      resource: createTenantResourceRef({
        type: "automation_rule_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_automation_read" },
    });
    expect(decision.allowed).toBe(true);
  });

  it("deny override wins for locale manage", async () => {
    const decision = await can({
      tx: {
        $queryRaw: authorizationFactsQuery(
          [{ key: "locale.manage" }],
          [{ key: "locale.manage", effect: "DENY" }],
          [{ role_key: "admin", bypasses_resource_predicates: true }],
        ),
      },
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "locale.manage",
      resource: createTenantResourceRef({
        type: "locale_resource_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_locale_deny" },
    });
    expect(decision.allowed).toBe(false);
  });
});
