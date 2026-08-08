import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";

const {
  mockRequirePlatformPrincipal,
  mockReadPlatformTenants,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockResolveTenant,
  mockRequireActiveMembership,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockReadPlatformTenants: vi.fn(),
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
    readPlatformTenants: (...args: unknown[]) => mockReadPlatformTenants(...args),
  };
});

import { GET } from "../../backend/apps/api/src/app/api/v1/platform/tenants/route";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const listPayload = {
  data: [
    {
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
  ],
  page: {
    hasMore: true,
    nextCursor: "cursor-page-2",
  },
};

function createRequest(path = "/api/v1/platform/tenants", headers: Record<string, string> = {}) {
  return new NextRequest(`https://platform.example.com${path}`, {
    headers: {
      host: "platform.example.com",
      authorization: "Bearer platform-token",
      [ATLAS_PLATFORM_REASON_HEADER]: "Reviewing tenant inventory for support triage",
      ...headers,
    },
  });
}

describe("GET /api/v1/platform/tenants", () => {
  beforeEach(() => {
    mockRequirePlatformPrincipal.mockReset();
    mockReadPlatformTenants.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithPlatformScope.mockClear();
    mockResolveTenant.mockReset();
    mockRequireActiveMembership.mockReset();

    mockRequirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
      platformPermissions: ["platform.tenant.read"],
    });
    mockReadPlatformTenants.mockResolvedValue(listPayload);
  });

  it("lets a platform principal with platform.tenant.read list tenants", async () => {
    const response = await GET(createRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(listPayload);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.tenant.read",
      }),
    );
    expect(mockReadPlatformTenants).toHaveBeenCalledTimes(1);
  });

  it("denies requests missing a platform reason", async () => {
    const response = await GET(
      createRequest("/api/v1/platform/tenants", {
        [ATLAS_PLATFORM_REASON_HEADER]: "",
      }),
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReadPlatformTenants).not.toHaveBeenCalled();
  });

  it("denies regular tenant users without platform permissions", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadPlatformTenants).not.toHaveBeenCalled();
  });

  it("allows operations and support principals with platform.tenant.read", async () => {
    mockRequirePlatformPrincipal.mockResolvedValueOnce({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000011",
      platformPermissions: ["platform.tenant.read"],
    });
    await expect(GET(createRequest())).resolves.toMatchObject({ status: 200 });

    mockRequirePlatformPrincipal.mockResolvedValueOnce({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000012",
      platformPermissions: ["platform.tenant.read", "platform.support.access"],
    });
    await expect(GET(createRequest())).resolves.toMatchObject({ status: 200 });

    mockRequirePlatformPrincipal.mockRejectedValueOnce(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );
    const denied = await GET(createRequest());
    expect(denied.status).toBe(403);
  });

  it("uses cursor pagination in the response", async () => {
    const response = await GET(createRequest("/api/v1/platform/tenants?limit=25"));
    const body = (await response.json()) as {
      page: { hasMore: boolean; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.page).toEqual({
      hasMore: true,
      nextCursor: "cursor-page-2",
    });
    expect(mockReadPlatformTenants).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("does not grant platform access through tenant membership resolution", async () => {
    await GET(createRequest());

    expect(mockResolveTenant).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
  });
});
