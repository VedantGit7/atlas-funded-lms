import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import type * as PlatformTenantProvisioningModule from "@atlas/domain-tenancy/services/platform-tenant-provisioning.service";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const {
  mockRequirePlatformPrincipal,
  mockProvisionTenant,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockResolveTenant,
  mockRequireActiveMembership,
  mockAuditWriterWrite,
  mockOutboxPublish,
  findTenantBySlugMock,
  findTenantIdByProvisioningIdempotencyKeyMock,
  insertProvisioningTenantMock,
  insertProvisioningJobMock,
  insertFallbackTenantDomainMock,
  seedTenantSystemRolesFromCatalogueMock,
  seedOwnerInvitationFromExistingHelperMock,
  grantPlatformTenantEntitlementsMock,
  updateTenantStateMock,
  readPlatformTenantDetailMock,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockProvisionTenant: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithPlatformScope: vi.fn((_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }),
  ),
  mockResolveTenant: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockAuditWriterWrite: vi.fn(),
  mockOutboxPublish: vi.fn(),
  findTenantBySlugMock: vi.fn(),
  findTenantIdByProvisioningIdempotencyKeyMock: vi.fn(),
  insertProvisioningTenantMock: vi.fn(),
  insertProvisioningJobMock: vi.fn(),
  insertFallbackTenantDomainMock: vi.fn(),
  seedTenantSystemRolesFromCatalogueMock: vi.fn(),
  seedOwnerInvitationFromExistingHelperMock: vi.fn(),
  grantPlatformTenantEntitlementsMock: vi.fn(),
  updateTenantStateMock: vi.fn(),
  readPlatformTenantDetailMock: vi.fn(),
}));

async function getRealProvisionTenant() {
  const provisioning = await vi.importActual<typeof PlatformTenantProvisioningModule>(
    "@atlas/domain-tenancy/services/platform-tenant-provisioning.service",
  );
  return provisioning.provisionTenant;
}

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
    provisionTenant: (...args: unknown[]) => mockProvisionTenant(...args),
  };
});

vi.mock("@atlas/domain-tenancy/repositories/platform-tenant.repository", () => ({
  findTenantBySlug: (...args: unknown[]) => findTenantBySlugMock(...args),
  insertProvisioningTenant: (...args: unknown[]) => insertProvisioningTenantMock(...args),
  updateTenantState: (...args: unknown[]) => updateTenantStateMock(...args),
}));

vi.mock("@atlas/domain-tenancy/repositories/provisioning-job.repository", () => ({
  insertProvisioningJob: (...args: unknown[]) => insertProvisioningJobMock(...args),
  updateProvisioningJobStatus: vi.fn(),
  findTenantIdByProvisioningIdempotencyKey: (...args: unknown[]) =>
    findTenantIdByProvisioningIdempotencyKeyMock(...args),
}));

vi.mock("@atlas/domain-tenancy/repositories/platform-tenant-domain.repository", () => ({
  insertFallbackTenantDomain: (...args: unknown[]) => insertFallbackTenantDomainMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-entitlement.service", () => ({
  grantPlatformTenantEntitlements: (...args: unknown[]) =>
    grantPlatformTenantEntitlementsMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-read.service", () => ({
  readPlatformTenantDetail: (...args: unknown[]) => readPlatformTenantDetailMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-provisioning.helpers", () => ({
  seedTenantSystemRolesFromCatalogue: (...args: unknown[]) =>
    seedTenantSystemRolesFromCatalogueMock(...args),
  seedOwnerInvitationFromExistingHelper: (...args: unknown[]) =>
    seedOwnerInvitationFromExistingHelperMock(...args),
}));

vi.mock("@atlas/audit", () => ({
  auditWriter: {
    write: (...args: unknown[]) => mockAuditWriterWrite(...args),
  },
}));

vi.mock("@atlas/events", () => ({
  outbox: {
    publish: (...args: unknown[]) => mockOutboxPublish(...args),
  },
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/platform/tenants/route";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
  platformPermissions: ["platform.tenant.manage"],
};

const createBody = {
  slug: "acme-learning",
  displayName: "Acme Learning",
  owner: {
    email: "owner@acme.example.com",
    displayName: "Acme Owner",
  },
  initialEntitlements: [
    {
      key: "feature.community",
      enabled: true,
      value: null,
      expiresAt: null,
    },
  ],
};

const tenantResponse = {
  data: {
    id: tenantId,
    slug: createBody.slug,
    displayName: createBody.displayName,
    legalName: null,
    state: "ACTIVE",
    defaultLocale: "en",
    defaultTimezone: "UTC",
    primaryDomain: {
      id: "018f0000-0000-7000-8000-000000000020",
      hostname: "acme-learning.localhost.test",
      status: "ACTIVE",
      type: "atlas_subdomain",
    },
    provisioning: {
      latestJobId: "018f0000-0000-7000-8000-000000000021",
      latestStatus: "SUCCEEDED",
    },
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
};

function createRequest(headers: Record<string, string> = {}, body: unknown = createBody) {
  return new NextRequest("https://platform.example.com/api/v1/platform/tenants", {
    method: "POST",
    headers: {
      host: "platform.example.com",
      authorization: "Bearer platform-token",
      "content-type": "application/json",
      [ATLAS_PLATFORM_REASON_HEADER]: "Provisioning a new tenant for onboarding",
      "idempotency-key": "provision-key-001",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/platform/tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockProvisionTenant.mockResolvedValue(tenantResponse);
    findTenantBySlugMock.mockResolvedValue(null);
    findTenantIdByProvisioningIdempotencyKeyMock.mockResolvedValue(null);
    insertProvisioningTenantMock.mockResolvedValue({ id: tenantId });
    insertProvisioningJobMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000021" });
    insertFallbackTenantDomainMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000020",
    });
    updateTenantStateMock.mockResolvedValue({
      id: tenantId,
      previous_state: "PROVISIONING",
      state: "ACTIVE",
    });
    readPlatformTenantDetailMock.mockResolvedValue(tenantResponse);
  });

  it("lets a platform principal with platform.tenant.manage create a tenant", async () => {
    const response = await POST(createRequest());
    const body = (await response.json()) as typeof tenantResponse;

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(tenantId);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.tenant.manage",
      }),
    );
    expect(mockProvisionTenant).toHaveBeenCalledTimes(1);
  });

  it("requires Idempotency-Key", async () => {
    const response = await POST(createRequest({ "idempotency-key": "" }));
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockProvisionTenant).not.toHaveBeenCalled();
  });

  it("returns the existing tenant when the same slug is submitted again", async () => {
    mockProvisionTenant.mockImplementation(await getRealProvisionTenant());
    findTenantBySlugMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: tenantId });

    const first = await POST(createRequest());
    const second = await POST(createRequest({ "idempotency-key": "provision-key-002" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(insertProvisioningTenantMock).toHaveBeenCalledTimes(1);
    expect(mockProvisionTenant).toHaveBeenCalledTimes(2);
  });

  it("returns the original tenant when the same Idempotency-Key is replayed", async () => {
    mockProvisionTenant.mockImplementation(await getRealProvisionTenant());
    findTenantIdByProvisioningIdempotencyKeyMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(tenantId);

    const first = await POST(createRequest());
    const second = await POST(createRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(insertProvisioningTenantMock).toHaveBeenCalledTimes(1);
    expect(findTenantBySlugMock).toHaveBeenCalledTimes(1);
    expect(mockProvisionTenant).toHaveBeenCalledTimes(2);
  });

  it("denies requests missing a platform reason", async () => {
    const response = await POST(
      createRequest({
        [ATLAS_PLATFORM_REASON_HEADER]: "",
      }),
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockProvisionTenant).not.toHaveBeenCalled();
  });

  it("denies regular tenant users without platform permissions", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await POST(createRequest());
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockProvisionTenant).not.toHaveBeenCalled();
  });

  it("creates tenant, domain, job, owner invite, and entitlements through the provisioning service", async () => {
    mockProvisionTenant.mockImplementation(await getRealProvisionTenant());

    await POST(createRequest());

    expect(insertProvisioningTenantMock).toHaveBeenCalledTimes(1);
    expect(insertProvisioningJobMock).toHaveBeenCalledTimes(1);
    expect(insertFallbackTenantDomainMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId,
        hostname: "acme-learning.localhost.test",
      }),
    );
    expect(seedTenantSystemRolesFromCatalogueMock).toHaveBeenCalledWith(expect.anything(), {
      tenantId,
    });
    expect(seedOwnerInvitationFromExistingHelperMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId,
        email: createBody.owner.email,
      }),
    );
    expect(grantPlatformTenantEntitlementsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId,
        entitlements: [
          expect.objectContaining({
            key: "feature.community",
          }),
        ],
      }),
    );
  });

  it("writes audit entries and publishes outbox events during provisioning", async () => {
    mockProvisionTenant.mockImplementation(await getRealProvisionTenant());

    await POST(createRequest());

    expect(mockAuditWriterWrite).toHaveBeenCalledTimes(2);
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "tenant.created" }),
    );
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "tenant.state_changed" }),
    );
  });
});
