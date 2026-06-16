import { describe, expect, it, vi } from "vitest";
import { resolveTenantFromRequest } from "@atlas/tenancy";

function requestWithSpoofedTenantHeaders() {
  return new Request("https://tenant-a.example.com/api/v1/me", {
    headers: {
      host: "tenant-a.example.com",
      "x-tenant-id": "spoofed-tenant-b",
      "x-atlas-tenant-id": "spoofed-internal-tenant-b",
    },
  });
}

describe("tenant resolution invariant", () => {
  it("host wins over client-supplied tenant headers", async () => {
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
      req: requestWithSpoofedTenantHeaders(),
      db,
    });

    expect(resolved.tenantId).toBe("tenant-a-id");
    expect(resolved.tenantSlug).toBe("tenant-a");
  });
});
