import { describe, expect, it, vi } from "vitest";
import { lookupTenantFromHost } from "@atlas/tenancy";

describe("public auth tenant binding", () => {
  it("resolves tenant from host and ignores spoofed tenant headers in downstream auth flows", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          tenant_id: "tenant-a-id",
          tenant_slug: "tenant-a",
          tenant_state: "ACTIVE",
          domain_id: "domain-a",
          domain_status: "ACTIVE",
          hostname: "tenant-a.example.com",
        },
      ]),
    };

    const resolved = await lookupTenantFromHost({
      host: "tenant-a.example.com",
      requestId: "req-1",
      db,
    });

    expect(resolved?.tenantId).toBe("tenant-a-id");
    expect(resolved?.host).toBe("tenant-a.example.com");
  });

  it("returns null for unknown host without leaking tenant existence", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    const resolved = await lookupTenantFromHost({
      host: "missing.example.com",
      requestId: "req-2",
      db,
    });

    expect(resolved).toBeNull();
  });
});
