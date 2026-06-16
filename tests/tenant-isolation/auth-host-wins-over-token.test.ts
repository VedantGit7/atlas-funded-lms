import { describe, expect, it, vi } from "vitest";
import { resolveTenantFromRequest } from "@atlas/tenancy";

function requestWithSpoofedTenantContext() {
  return new Request("https://tenant-a.example.com/api/v1/me", {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer token-with-tenant-b-claim",
      "x-tenant-id": "tenant-b-id",
      "x-atlas-tenant-id": "tenant-b-id",
    },
  });
}

describe("auth tenant isolation", () => {
  it("host wins over token and client tenant claims before auth resolution", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          tenant_id: "tenant-a-id",
          tenant_slug: "tenant-a",
          tenant_state: "ACTIVE",
          domain_id: "tenant-a-domain-id",
          domain_status: "ACTIVE",
          hostname: "tenant-a.example.com",
        },
      ]),
    };

    const resolved = await resolveTenantFromRequest({
      req: requestWithSpoofedTenantContext(),
      db,
    });

    expect(resolved.tenantId).toBe("tenant-a-id");
    expect(resolved.tenantSlug).toBe("tenant-a");
    expect(resolved.host).toBe("tenant-a.example.com");
  });
});
