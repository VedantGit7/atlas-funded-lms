import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as BrandingPublishModule from "@atlas/domain-branding/services/branding-publish.service";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";

const publishedBranding = {
  data: {
    tenantId: tenantA.tenantId,
    displayName: "Atlas Tenant",
    publicName: "Acme Academy",
    logoLight: null,
    logoDark: null,
    favicon: null,
    issuerName: "Acme Academy Issuer",
    publicLandingCopy: null,
    status: "PUBLISHED" as const,
    version: 1,
    updatedAt: "2025-01-02T00:00:00.000Z",
    publishedAt: "2025-01-02T00:00:00.000Z",
  },
};

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockPublishTenantBrandingAndTheme,
  mockWithGlobalDb,
  mockWithTenantTx,
  getTenantBrandingMock,
  getTenantThemeMock,
  insertTenantBrandingVersionMock,
  insertTenantThemeVersionMock,
  markBrandingPublishedMock,
  markThemePublishedMock,
  auditWriterWriteMock,
  outboxPublishMock,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockPublishTenantBrandingAndTheme: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }),
  ),
  getTenantBrandingMock: vi.fn(),
  getTenantThemeMock: vi.fn(),
  insertTenantBrandingVersionMock: vi.fn(),
  insertTenantThemeVersionMock: vi.fn(),
  markBrandingPublishedMock: vi.fn(),
  markThemePublishedMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
}));

async function getRealPublishTenantBrandingAndTheme() {
  const mod = await vi.importActual<typeof BrandingPublishModule>(
    "@atlas/domain-branding/services/branding-publish.service",
  );
  return mod.publishTenantBrandingAndTheme;
}

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
    publishTenantBrandingAndTheme: (...args: unknown[]) =>
      mockPublishTenantBrandingAndTheme(...args),
  };
});

vi.mock("@atlas/domain-branding/repositories/branding.repository", () => ({
  getTenantBranding: (...args: unknown[]) => getTenantBrandingMock(...args),
  insertTenantBrandingVersion: (...args: unknown[]) => insertTenantBrandingVersionMock(...args),
  markBrandingPublished: (...args: unknown[]) => markBrandingPublishedMock(...args),
}));

vi.mock("@atlas/domain-branding/repositories/theme.repository", () => ({
  getTenantTheme: (...args: unknown[]) => getTenantThemeMock(...args),
  insertTenantThemeVersion: (...args: unknown[]) => insertTenantThemeVersionMock(...args),
  markThemePublished: (...args: unknown[]) => markThemePublishedMock(...args),
}));

vi.mock("@atlas/audit", () => ({
  auditWriter: {
    write: (...args: unknown[]) => auditWriterWriteMock(...args),
  },
}));

vi.mock("@atlas/events", () => ({
  outbox: {
    publish: (...args: unknown[]) => outboxPublishMock(...args),
  },
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/branding/publish/route";
import { routeMetadata } from "../../backend/apps/api/src/app/api/v1/branding/publish/route.metadata";

function createPostRequest(headers: Record<string, string> = {}) {
  return new NextRequest("https://tenant-a.example.com/api/v1/branding/publish", {
    method: "POST",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "content-type": "application/json",
      "idempotency-key": "branding-publish-key-001",
      ...headers,
    },
    body: JSON.stringify({}),
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
  mockCan.mockResolvedValue({
    allowed: true,
    permission: "branding.publish",
    reason: "ALLOWED",
    matchedRoleKeys: ["admin"],
    bypassedResourcePredicate: true,
  });
}

describe("POST /api/v1/branding/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin();
    mockPublishTenantBrandingAndTheme.mockResolvedValue(publishedBranding);
    auditWriterWriteMock.mockResolvedValue(undefined);
    outboxPublishMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
    getTenantBrandingMock.mockResolvedValue({
      tenant_id: tenantA.tenantId,
      display_name: "Atlas Tenant",
      public_name: "Acme Academy",
      version: 0,
      status: "DRAFT",
    });
    getTenantThemeMock.mockResolvedValue({
      tenant_id: tenantA.tenantId,
      tokens_json: { primary: "#112233" },
      version: 0,
      status: "DRAFT",
    });
    insertTenantBrandingVersionMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000020",
      version: 1,
    });
    insertTenantThemeVersionMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000021",
      version: 1,
    });
    markBrandingPublishedMock.mockResolvedValue({
      tenant_id: tenantA.tenantId,
      display_name: "Atlas Tenant",
      public_name: "Acme Academy",
      logo_light_ref_id: null,
      logo_dark_ref_id: null,
      favicon_ref_id: null,
      issuer_name: "Acme Academy Issuer",
      public_landing_copy_json: null,
      status: "PUBLISHED",
      version: 1,
      updated_at: new Date("2025-01-02T00:00:00.000Z"),
      published_at: new Date("2025-01-02T00:00:00.000Z"),
    });
    markThemePublishedMock.mockResolvedValue({
      tenant_id: tenantA.tenantId,
      tokens_json: { primary: "#112233" },
      status: "PUBLISHED",
      version: 1,
    });
  });

  it("requires branding.publish permission at the route layer", () => {
    expect(routeMetadata.permission).toBe("branding.publish");
  });

  it("lets users with branding.publish publish tenant branding", async () => {
    const response = await POST(createPostRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(publishedBranding);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "branding.publish",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: adminMembershipId,
        }),
      }),
    );
    expect(mockPublishTenantBrandingAndTheme).toHaveBeenCalledTimes(1);
  });

  it("requires Idempotency-Key", async () => {
    const response = await POST(createPostRequest({ "idempotency-key": "" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockPublishTenantBrandingAndTheme).not.toHaveBeenCalled();
  });

  it("denies non-admin users without branding.publish", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "branding.publish",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await POST(createPostRequest());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockPublishTenantBrandingAndTheme).not.toHaveBeenCalled();
  });

  it("writes audit and publishes config.branding.published outbox event", async () => {
    mockPublishTenantBrandingAndTheme.mockImplementation(
      await getRealPublishTenantBrandingAndTheme(),
    );

    await POST(createPostRequest());

    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: tenantA.tenantId,
        actorMembershipId: adminMembershipId,
      }),
      expect.objectContaining({
        action: "config.branding.published",
      }),
    );
    expect(outboxPublishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "config.branding.published",
        payload: expect.objectContaining({
          tenantId: tenantA.tenantId,
          brandingVersion: 1,
          themeVersion: 1,
        }),
      }),
    );
  });
});
