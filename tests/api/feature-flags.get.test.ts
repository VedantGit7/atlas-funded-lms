import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockListTenantFeatureFlags,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockListTenantFeatureFlags: vi.fn(),
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
  };
});

vi.mock("@atlas/domain-config/services/feature-flag.service", () => ({
  listTenantFeatureFlags: (...args: unknown[]) => mockListTenantFeatureFlags(...args),
}));

import { GET } from "../../backend/apps/api/src/app/api/v1/feature-flags/route";

const tenantA = {
  tenantId: "tenant-a-id",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const effectiveFlagsPayload = {
  data: [
    {
      key: "community.enable",
      value: false,
      source: "GLOBAL_DEFAULT" as const,
      readOnly: true,
    },
    {
      key: "analytics.dashboard.view",
      value: { enabled: true, tier: "advanced" },
      source: "TENANT_OVERRIDE" as const,
      readOnly: false,
    },
  ],
};

function createRequest(path = "/api/v1/feature-flags") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

describe("GET /api/v1/feature-flags", () => {
  beforeEach(() => {
    mockResolveTenant.mockReset();
    mockRequireSupabaseUser.mockReset();
    mockUpsertAuthPrincipal.mockReset();
    mockRequireActiveMembership.mockReset();
    mockCan.mockReset();
    mockListTenantFeatureFlags.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithTenantTx.mockClear();

    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "018f0000-0000-7000-8000-000000000001",
      email: "admin@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000099",
      email: "admin@example.com",
    });
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: "admin-membership-id",
      status: "ACTIVE",
    });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "feature_flag.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
    mockListTenantFeatureFlags.mockResolvedValue(effectiveFlagsPayload);
  });

  it("lets owner/admin with feature_flag.read receive effective flags", async () => {
    const response = await GET(createRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(effectiveFlagsPayload);
    expect(mockListTenantFeatureFlags).toHaveBeenCalledTimes(1);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "feature_flag.read",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: "admin-membership-id",
        }),
      }),
    );
  });

  it("returns tenant override values ahead of global defaults", async () => {
    const response = await GET(createRequest());
    const body = (await response.json()) as typeof effectiveFlagsPayload;

    const overriddenFlag = body.data.find((flag) => flag.key === "analytics.dashboard.view");
    const globalDefaultFlag = body.data.find((flag) => flag.key === "community.enable");

    expect(overriddenFlag).toMatchObject({
      source: "TENANT_OVERRIDE",
      value: { enabled: true, tier: "advanced" },
    });
    expect(globalDefaultFlag).toMatchObject({
      source: "GLOBAL_DEFAULT",
      value: false,
    });
  });

  it("marks entitlement-backed flags as readOnly", async () => {
    const response = await GET(createRequest());
    const body = (await response.json()) as typeof effectiveFlagsPayload;

    const entitlementBackedFlag = body.data.find((flag) => flag.key === "community.enable");

    expect(entitlementBackedFlag?.readOnly).toBe(true);
  });

  it("returns PERMISSION_DENIED for users without feature_flag.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "feature_flag.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockListTenantFeatureFlags).not.toHaveBeenCalled();
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await GET(createRequest("/api/v1/feature-flags?tenant_id=tenant-b-id"));
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});
