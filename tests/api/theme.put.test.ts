import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";

const themePayload = {
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
};

const themeResponse = {
  ...themePayload,
  publishedBaselineTokens: null,
};

const validPutBody = {
  tokens: {
    primary: "#112233",
    accent: "#445566",
    radius: "md",
    modeDefault: "system",
  },
};

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockUpdateTenantThemeDraft,
  mockReadTenantTheme,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockUpdateTenantThemeDraft: vi.fn(),
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
    updateTenantThemeDraft: (...args: unknown[]) => mockUpdateTenantThemeDraft(...args),
    readTenantTheme: (...args: unknown[]) => mockReadTenantTheme(...args),
  };
});

import { PUT } from "../../backend/apps/api/src/app/api/v1/theme/route";

function createPutRequest(
  headers: Record<string, string> = {},
  body: unknown = validPutBody,
  path = "/api/v1/theme",
) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    method: "PUT",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "content-type": "application/json",
      "idempotency-key": "theme-update-key-001",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/v1/theme", () => {
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
    mockUpdateTenantThemeDraft.mockResolvedValue(themePayload);
    mockReadTenantTheme.mockResolvedValue(themeResponse);
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "branding.update",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
  });

  it("lets users with branding.update replace tenant theme draft", async () => {
    const response = await PUT(createPutRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(themeResponse);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "branding.update",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: adminMembershipId,
        }),
      }),
    );
    expect(mockUpdateTenantThemeDraft).toHaveBeenCalledTimes(1);
    expect(mockReadTenantTheme).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid color values", async () => {
    const response = await PUT(
      createPutRequest(
        {},
        {
          tokens: {
            primary: "not-a-color",
          },
        },
      ),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockUpdateTenantThemeDraft).not.toHaveBeenCalled();
  });

  it("requires Idempotency-Key", async () => {
    const response = await PUT(createPutRequest({ "idempotency-key": "" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockUpdateTenantThemeDraft).not.toHaveBeenCalled();
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await PUT(
      createPutRequest({}, validPutBody, "/api/v1/theme?tenant_id=tenant-b-id"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });
});
