import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

describe("can tenant isolation", () => {
  it("denies cross-tenant resource refs before role evaluation", async () => {
    const tx = {
      $queryRaw: vi.fn(),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "member-a" },
      permission: "course.read",
      resource: createTenantResourceRef({
        type: "course",
        id: "course-b",
        tenantId: "tenant-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_test" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("TENANT_MISMATCH");
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
