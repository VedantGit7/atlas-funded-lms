import { describe, expect, it, vi } from "vitest";
import { resolveTenantFromHost } from "@atlas/tenancy";

function mockDb(rows: unknown[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
  };
}

describe("resolveTenantFromHost", () => {
  it("resolves an ACTIVE tenant from an ACTIVE domain", async () => {
    const db = mockDb([
      {
        tenant_id: "018f0000-0000-7000-8000-000000000001",
        tenant_slug: "tenant-b",
        tenant_state: "ACTIVE",
        domain_id: "018f0000-0000-7000-8000-000000000010",
        domain_status: "ACTIVE",
        hostname: "academy.tenant-b.example.com",
      },
    ]);

    await expect(
      resolveTenantFromHost({
        host: "academy.tenant-b.example.com",
        requestId: "req_00000000-0000-4000-8000-000000000000",
        db,
      }),
    ).resolves.toMatchObject({
      tenantSlug: "tenant-b",
      host: "academy.tenant-b.example.com",
      tenantState: "ACTIVE",
    });
  });

  it("returns safe not found for unknown host", async () => {
    const db = mockDb([]);

    await expect(
      resolveTenantFromHost({
        host: "unknown.example.com",
        requestId: "req_00000000-0000-4000-8000-000000000000",
        db,
      }),
    ).rejects.toMatchObject({
      code: "TENANT_NOT_FOUND",
      status: 404,
    });
  });

  it("blocks inactive tenant state", async () => {
    const db = mockDb([
      {
        tenant_id: "018f0000-0000-7000-8000-000000000001",
        tenant_slug: "tenant-a",
        tenant_state: "SUSPENDED",
        domain_id: "018f0000-0000-7000-8000-000000000010",
        domain_status: "ACTIVE",
        hostname: "tenant-a.example.com",
      },
    ]);

    await expect(
      resolveTenantFromHost({
        host: "tenant-a.example.com",
        requestId: "req_00000000-0000-4000-8000-000000000000",
        db,
      }),
    ).rejects.toMatchObject({
      code: "TENANT_UNAVAILABLE",
      status: 503,
    });
  });

  it("answers an unverified domain exactly like an unknown host", async () => {
    // The database function already returns only verified domains; this is
    // the defensive check behind it, and it must not reveal the claim either.
    const db = mockDb([
      {
        tenant_id: "018f0000-0000-7000-8000-000000000001",
        tenant_slug: "tenant-a",
        tenant_state: "ACTIVE",
        domain_id: "018f0000-0000-7000-8000-000000000010",
        domain_status: "VERIFYING",
        hostname: "tenant-a.example.com",
      },
    ]);

    await expect(
      resolveTenantFromHost({
        host: "tenant-a.example.com",
        requestId: "req_00000000-0000-4000-8000-000000000000",
        db,
      }),
    ).rejects.toMatchObject({
      code: "TENANT_NOT_FOUND",
      status: 404,
    });
  });

  it("looks the host up through the exact-match function, never the table", async () => {
    const db = mockDb([]);

    await resolveTenantFromHost({
      host: "Academy.Tenant-B.example.com:443",
      requestId: "req_00000000-0000-4000-8000-000000000000",
      db,
    }).catch(() => undefined);

    const [strings, ...values] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join("?")).toMatch(/from app\.resolve_tenant_host\(\?\)/);
    expect(strings.join("?")).not.toMatch(/tenant_domains/);
    expect(values).toEqual(["academy.tenant-b.example.com"]);
  });
});
