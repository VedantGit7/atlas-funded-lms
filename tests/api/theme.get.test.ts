import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";

const themeResponse = {
  data: {
    tenantId: tenantA.tenantId,
    tokens: {
      primary: "#112233",
      radius: "md" as const,
      modeDefault: "system" as const,
    },
    status: "DRAFT" as const,
    version: 0,
    updatedAt: "2025-01-01T00:00:00.000Z",
    publishedAt: null,
  },
  publishedBaselineTokens: null,
};

const {
  mockResolveTenant,
  mockRequireSessionUser,
  mockResolveSessionPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantTheme,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSessionUser: vi.fn(),
  mockResolveSessionPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockReadTenantTheme: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      // A bare vi.fn() returns undefined, so any repository doing rows[0] throws.
      // The route pipeline now claims an idempotency key through this tx (M10),
      // which made that latent stub gap visible as a 500.
      $queryRaw: vi.fn().mockResolvedValue([]),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
}));

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/api/session-user", () => ({
  requireSessionUser: (...args: unknown[]) => mockRequireSessionUser(...args),
  resolveSessionPrincipal: (...args: unknown[]) => mockResolveSessionPrincipal(...args),
}));

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
    readTenantTheme: (...args: unknown[]) => mockReadTenantTheme(...args),
  };
});

import { GET } from "../../backend/apps/api/src/app/api/v1/theme/route";

function createGetRequest(path = "/api/v1/theme") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    method: "GET",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

describe("GET /api/v1/theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSessionUser.mockResolvedValue({
      principalId: "018f0000-0000-7000-8000-000000000099",
      email: "admin@example.com",
      mfaEnabled: false,
    });
    mockResolveSessionPrincipal.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000098",
      email: "admin@example.com",
    });
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: adminMembershipId,
      status: "ACTIVE",
    });
    mockReadTenantTheme.mockResolvedValue(themeResponse);
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "branding.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
  });

  it("returns theme draft and published baseline for branding.read", async () => {
    const response = await GET(createGetRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(themeResponse);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "branding.read",
      }),
    );
    expect(mockReadTenantTheme).toHaveBeenCalledTimes(1);
  });
});
