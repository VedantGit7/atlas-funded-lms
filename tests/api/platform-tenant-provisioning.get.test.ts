import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const {
  mockRequirePlatformPrincipal,
  mockReadTenantProvisioningJobs,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockResolveTenant,
  mockRequireActiveMembership,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockReadTenantProvisioningJobs: vi.fn(),
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
    readTenantProvisioningJobs: (...args: unknown[]) => mockReadTenantProvisioningJobs(...args),
  };
});

import { GET } from "../../apps/web/src/app/api/v1/platform/tenants/[id]/provisioning/route";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
  platformPermissions: ["platform.tenant.read"],
};

const provisioningPayload = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000021",
      tenantId,
      status: "SUCCEEDED",
      step: "finalize",
      errorCode: null,
      safeErrorMessage: null,
      idempotencyKey: "provision-key-001",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:01:00.000Z",
    },
  ],
};

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://platform.example.com/api/v1/platform/tenants/${tenantId}/provisioning`,
    {
      headers: {
        host: "platform.example.com",
        authorization: "Bearer platform-token",
        [ATLAS_PLATFORM_REASON_HEADER]: "Reviewing tenant provisioning jobs for support triage",
        ...headers,
      },
    },
  );
}

describe("GET /api/v1/platform/tenants/[id]/provisioning", () => {
  beforeEach(() => {
    mockRequirePlatformPrincipal.mockReset();
    mockReadTenantProvisioningJobs.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithPlatformScope.mockClear();
    mockResolveTenant.mockReset();
    mockRequireActiveMembership.mockReset();

    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockReadTenantProvisioningJobs.mockResolvedValue(provisioningPayload);
  });

  it("lets a platform principal with platform.tenant.read view provisioning jobs", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: tenantId }),
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(provisioningPayload);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.tenant.read",
      }),
    );
    expect(mockReadTenantProvisioningJobs).toHaveBeenCalledWith(expect.anything(), tenantId);
  });

  it("requires a platform reason", async () => {
    const response = await GET(
      createRequest({
        [ATLAS_PLATFORM_REASON_HEADER]: "",
      }),
      {
        params: Promise.resolve({ id: tenantId }),
      },
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReadTenantProvisioningJobs).not.toHaveBeenCalled();
  });

  it("denies regular tenant sessions without platform permissions", async () => {
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
    expect(mockReadTenantProvisioningJobs).not.toHaveBeenCalled();
    expect(mockResolveTenant).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
  });
});
