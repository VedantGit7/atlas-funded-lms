import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

describe("can platform permission isolation", () => {
  it("denies platform permissions in tenant scope", async () => {
    const tx = {
      $queryRaw: authorizationFactsQuery([{ key: "platform.tenant.manage" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "platform.tenant.manage",
      resource: createTenantResourceRef({
        type: "tenant",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("PLATFORM_PERMISSION_IN_TENANT_SCOPE");
  });
});
