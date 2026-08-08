import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const {
  mockRequirePlatformPrincipal,
  mockReadPlatformTenantDetail,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockResolveTenant,
  mockRequireActiveMembership,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockReadPlatformTenantDetail: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithPlatformScope: vi.fn((_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
  mockResolveTenant: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mockRequirePlatformPrincipal(...args),
}));

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    withPlatformScope: mockWithPlatformScope,
  };
});

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/membership", () => ({
  requireActiveMembership: (...args: unknown[]) => mockRequireActiveMembership(...args),
}));

vi.mock("@atlas/domain-tenancy", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readPlatformTenantDetail: (...args: unknown[]) => mockReadPlatformTenantDetail(...args),
  };
});

import { GET } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/route";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
  platformPermissions: ["platform.tenant.read"],
};

const tenantDetail = {
  data: {
    id: tenantId,
    slug: "acme-learning",
    displayName: "Acme Learning",
    legalName: null,
    state: "ACTIVE",
    defaultLocale: "en",
    defaultTimezone: "UTC",
    primaryDomain: null,
    provisioning: {
      latestJobId: null,
      latestStatus: null,
    },
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
};

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest(`https://platform.example.com/api/v1/platform/tenants/${tenantId}`, {
    headers: {
      host: "platform.example.com",
      authorization: "Bearer platform-token",
      [ATLAS_PLATFORM_REASON_HEADER]: "Inspecting tenant detail for support triage",
      ...headers,
    },
  });
}

describe("GET /api/v1/platform/tenants/[id]", () => {
  beforeEach(() => {
    mockRequirePlatformPrincipal.mockReset();
    mockReadPlatformTenantDetail.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithPlatformScope.mockClear();
    mockResolveTenant.mockReset();
    mockRequireActiveMembership.mockReset();

    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockReadPlatformTenantDetail.mockResolvedValue(tenantDetail);
  });

  it("lets a platform principal with platform.tenant.read inspect one tenant", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: tenantId }),
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(tenantDetail);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.tenant.read",
      }),
    );
    expect(mockReadPlatformTenantDetail).toHaveBeenCalledWith(expect.anything(), tenantId);
  });

  it("returns safe TENANT_NOT_FOUND when the tenant does not exist", async () => {
    mockReadPlatformTenantDetail.mockRejectedValue(
      new AtlasHttpError({
        code: "TENANT_NOT_FOUND",
        status: 404,
        message: "Tenant not found",
      }),
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: tenantId }),
    });
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("TENANT_NOT_FOUND");
    expect(body.error.message).toBe("Tenant not found");
  });

  it("denies regular tenant users without platform permissions", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: tenantId }),
    });
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadPlatformTenantDetail).not.toHaveBeenCalled();
  });

  it("does not grant platform tenant detail through tenant membership resolution", async () => {
    await GET(createRequest(), {
      params: Promise.resolve({ id: tenantId }),
    });

    expect(mockResolveTenant).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
  });
});
