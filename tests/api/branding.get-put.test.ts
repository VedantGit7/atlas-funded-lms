import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";

const brandingPayload = {
  data: {
    tenantId: tenantA.tenantId,
    displayName: "Atlas Tenant",
    publicName: "Acme Academy",
    logoLight: null,
    logoDark: null,
    favicon: null,
    issuerName: "Acme Academy Issuer",
    publicLandingCopy: null,
    status: "DRAFT" as const,
    version: 0,
    updatedAt: "2025-01-01T00:00:00.000Z",
    publishedAt: null,
  },
};

const putBody = {
  publicName: "Acme Academy",
  issuerName: "Acme Academy Issuer",
};

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantBranding,
  mockUpdateTenantBrandingDraft,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockReadTenantBranding: vi.fn(),
  mockUpdateTenantBrandingDraft: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }),
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
    readTenantBranding: (...args: unknown[]) => mockReadTenantBranding(...args),
    updateTenantBrandingDraft: (...args: unknown[]) => mockUpdateTenantBrandingDraft(...args),
  };
});

import { GET, PUT } from "../../backend/apps/api/src/app/api/v1/branding/route";

function createGetRequest(path = "/api/v1/branding") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

function createPutRequest(
  headers: Record<string, string> = {},
  body: unknown = putBody,
  path = "/api/v1/branding",
) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    method: "PUT",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "content-type": "application/json",
      "idempotency-key": "branding-update-key-001",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function setupAuthenticatedAdmin() {
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
}

describe("GET /api/v1/branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin();
    mockReadTenantBranding.mockResolvedValue(brandingPayload);
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "branding.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
  });

  it("lets users with branding.read receive tenant branding", async () => {
    const response = await GET(createGetRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(brandingPayload);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "branding.read",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: adminMembershipId,
        }),
      }),
    );
    expect(mockReadTenantBranding).toHaveBeenCalledTimes(1);
  });

  it("denies learners without branding.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "branding.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await GET(createGetRequest());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadTenantBranding).not.toHaveBeenCalled();
  });

  it("denies instructors without branding.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "branding.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await GET(createGetRequest());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadTenantBranding).not.toHaveBeenCalled();
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await GET(createGetRequest("/api/v1/branding?tenant_id=tenant-b-id"));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin();
    mockUpdateTenantBrandingDraft.mockResolvedValue(brandingPayload);
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "branding.update",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
  });

  it("lets users with branding.update replace tenant branding draft", async () => {
    const response = await PUT(createPutRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(brandingPayload);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "branding.update",
      }),
    );
    expect(mockUpdateTenantBrandingDraft).toHaveBeenCalledWith(expect.anything(), putBody);
  });

  it("denies learners without branding.update", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "branding.update",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await PUT(createPutRequest());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockUpdateTenantBrandingDraft).not.toHaveBeenCalled();
  });

  it("denies instructors without branding.update", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "branding.update",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await PUT(createPutRequest());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockUpdateTenantBrandingDraft).not.toHaveBeenCalled();
  });

  it("requires Idempotency-Key", async () => {
    const response = await PUT(createPutRequest({ "idempotency-key": "" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockUpdateTenantBrandingDraft).not.toHaveBeenCalled();
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await PUT(
      createPutRequest({}, putBody, "/api/v1/branding?tenant_id=tenant-b-id"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});
