import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const tenantBVersionId = "018f0000-0000-7000-8000-000000000099";

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";

const tenantAVersions = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000020",
      version: 1,
      snapshot: { tenantId: tenantA.tenantId, publicName: "Acme Academy" },
      publishedByMembershipId: adminMembershipId,
      publishedAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantBrandingVersions,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockReadTenantBrandingVersions: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
}));

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireSupabaseUser: (...args: unknown[]) => mockRequireSupabaseUser(...args),
    upsertAuthPrincipal: (...args: unknown[]) => mockUpsertAuthPrincipal(...args),
  };
});

vi.mock("@atlas/membership", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireActiveMembership: (...args: unknown[]) => mockRequireActiveMembership(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => mockCan(...args),
    enforceEntitlement: vi.fn(),
  };
});

vi.mock("@atlas/domain-branding", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readTenantBrandingVersions: (...args: unknown[]) => mockReadTenantBrandingVersions(...args),
  };
});

import { GET } from "../../backend/apps/api/src/app/api/v1/branding/versions/route";

function createGetRequest(path = "/api/v1/branding/versions") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

describe("GET /api/v1/branding/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "018f0000-0000-7000-8000-000000000099",
      email: "admin@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000098",
      email: "admin@example.com",
    });
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: adminMembershipId,
      status: "ACTIVE",
    });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "branding.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
    mockReadTenantBrandingVersions.mockResolvedValue(tenantAVersions);
  });

  it("lets users with branding.read list tenant branding versions", async () => {
    const response = await GET(createGetRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(tenantAVersions);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "branding.read",
      }),
    );
    expect(mockReadTenantBrandingVersions).toHaveBeenCalledTimes(1);
  });

  it("scopes version reads to the resolved tenant context", async () => {
    await GET(createGetRequest());

    expect(mockWithTenantTx).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA.tenantId,
      }),
      expect.any(Function),
    );
    expect(mockResolveTenant).toHaveBeenCalledTimes(1);
  });

  it("does not leak other tenant version ids in the response", async () => {
    const response = await GET(createGetRequest());
    const body = (await response.json()) as typeof tenantAVersions;

    expect(body.data.every((version) => version.id !== tenantBVersionId)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(tenantBVersionId);
    for (const version of body.data) {
      expect((version.snapshot as { tenantId?: string }).tenantId).toBe(tenantA.tenantId);
    }
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await GET(createGetRequest("/api/v1/branding/versions?tenant_id=tenant-b-id"));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});
