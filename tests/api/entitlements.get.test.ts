import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockListTenantEntitlements,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockListTenantEntitlements: vi.fn(),
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

vi.mock("@atlas/domain-config/services/entitlement.service", () => ({
  listTenantEntitlements: (...args: unknown[]) => mockListTenantEntitlements(...args),
}));

import { GET } from "../../apps/web/src/app/api/v1/entitlements/route";

const tenantA = {
  tenantId: "tenant-a-id",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const principal = {
  id: "018f0000-0000-7000-8000-000000000099",
  email: "admin@example.com",
};

const entitlementsPayload = {
  data: [
    {
      key: "community.enable",
      value: true,
      enabled: true,
      expiresAt: null,
    },
  ],
};

function createRequest(path = "/api/v1/entitlements") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

describe("GET /api/v1/entitlements", () => {
  beforeEach(() => {
    mockResolveTenant.mockReset();
    mockRequireSupabaseUser.mockReset();
    mockUpsertAuthPrincipal.mockReset();
    mockRequireActiveMembership.mockReset();
    mockCan.mockReset();
    mockListTenantEntitlements.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithTenantTx.mockClear();

    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "018f0000-0000-7000-8000-000000000001",
      email: "admin@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue(principal);
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: "admin-membership-id",
      status: "ACTIVE",
    });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "entitlement.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
    mockListTenantEntitlements.mockResolvedValue(entitlementsPayload);
  });

  it("lets owner/admin with entitlement.read receive own tenant entitlements", async () => {
    const response = await GET(createRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(entitlementsPayload);
    expect(mockResolveTenant).toHaveBeenCalledTimes(1);
    expect(mockListTenantEntitlements).toHaveBeenCalledTimes(1);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "entitlement.read",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: "admin-membership-id",
        }),
      }),
    );
  });

  it("returns PERMISSION_DENIED for learner without entitlement.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "entitlement.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockListTenantEntitlements).not.toHaveBeenCalled();
  });

  it("returns NO_MEMBERSHIP when the caller has no ACTIVE membership", async () => {
    mockRequireActiveMembership.mockRejectedValue(
      new AtlasHttpError({
        code: "NO_MEMBERSHIP",
        status: 403,
        message: "No membership for this tenant",
      }),
    );

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("NO_MEMBERSHIP");
    expect(mockCan).not.toHaveBeenCalled();
    expect(mockListTenantEntitlements).not.toHaveBeenCalled();
  });

  it("does not expose global auth_principal id in the response", async () => {
    const response = await GET(createRequest());
    const bodyText = await response.text();

    expect(bodyText).not.toContain(principal.id);
    expect(bodyText).not.toContain("authPrincipalId");
    expect(bodyText).not.toContain("auth_principal_id");

    const body = JSON.parse(bodyText) as {
      data: Array<Record<string, unknown>>;
    };

    for (const item of body.data) {
      expect(item).not.toHaveProperty("authPrincipalId");
      expect(item).not.toHaveProperty("auth_principal_id");
      expect(item).not.toHaveProperty("principalId");
    }
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await GET(createRequest("/api/v1/entitlements?tenant_id=tenant-b-id"));
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});
