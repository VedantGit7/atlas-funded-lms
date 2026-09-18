import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { assertTenantActive } from "@atlas/tenancy";
import type * as PlatformTenantLifecycleModule from "@atlas/domain-tenancy/services/platform-tenant-lifecycle.service";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const {
  mockRequirePlatformPrincipal,
  mockSuspendTenant,
  mockResumeTenant,
  mockArchiveTenant,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockRequireActiveMembership,
  mockAuditWriterWrite,
  mockOutboxPublish,
  updateTenantStateMock,
  readPlatformTenantDetailMock,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockSuspendTenant: vi.fn(),
  mockResumeTenant: vi.fn(),
  mockArchiveTenant: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithPlatformScope: vi.fn((_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
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
  mockRequireActiveMembership: vi.fn(),
  mockAuditWriterWrite: vi.fn(),
  mockOutboxPublish: vi.fn(),
  updateTenantStateMock: vi.fn(),
  readPlatformTenantDetailMock: vi.fn(),
}));

async function getRealLifecycleFns() {
  const lifecycle = await vi.importActual<typeof PlatformTenantLifecycleModule>(
    "@atlas/domain-tenancy/services/platform-tenant-lifecycle.service",
  );
  return lifecycle;
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

vi.mock("@atlas/membership", () => ({
  requireActiveMembership: (...args: unknown[]) => mockRequireActiveMembership(...args),
}));

vi.mock("@atlas/domain-tenancy", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    suspendTenant: (...args: unknown[]) => mockSuspendTenant(...args),
    resumeTenant: (...args: unknown[]) => mockResumeTenant(...args),
    archiveTenant: (...args: unknown[]) => mockArchiveTenant(...args),
  };
});

vi.mock("@atlas/domain-tenancy/repositories/platform-tenant.repository", () => ({
  updateTenantState: (...args: unknown[]) => updateTenantStateMock(...args),
}));

vi.mock("@atlas/domain-tenancy/services/platform-tenant-read.service", () => ({
  readPlatformTenantDetail: (...args: unknown[]) => readPlatformTenantDetailMock(...args),
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

import { POST as suspendPost } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/suspend/route";
import { POST as resumePost } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/resume/route";
import { POST as archivePost } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/archive/route";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
  platformPermissions: ["platform.tenant.manage"],
};

const activeTenantDetail = {
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

const suspendedTenantDetail = {
  data: {
    ...activeTenantDetail.data,
    state: "SUSPENDED",
  },
};

function createLifecycleRequest(
  path: string,
  headers: Record<string, string> = {},
  bodyReason = "Suspending tenant for compliance review",
) {
  return new NextRequest(`https://platform.example.com${path}`, {
    method: "POST",
    headers: {
      host: "platform.example.com",
      authorization: "Bearer platform-token",
      "content-type": "application/json",
      [ATLAS_PLATFORM_REASON_HEADER]: "Suspending tenant for compliance review",
      "idempotency-key": "lifecycle-key-001",
      ...headers,
    },
    body: JSON.stringify({ reason: bodyReason }),
  });
}

const routeContext = { params: Promise.resolve({ id: tenantId }) };

describe("POST /api/v1/platform/tenants/[id]/lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockSuspendTenant.mockResolvedValue(activeTenantDetail);
    mockResumeTenant.mockResolvedValue(activeTenantDetail);
    mockArchiveTenant.mockResolvedValue(activeTenantDetail);
    readPlatformTenantDetailMock.mockResolvedValue(activeTenantDetail);
    mockAuditWriterWrite.mockResolvedValue(undefined);
    mockOutboxPublish.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  describe.each([
    {
      action: "suspend",
      path: `/api/v1/platform/tenants/${tenantId}/suspend`,
      handler: () => suspendPost,
      mockFn: () => mockSuspendTenant,
    },
    {
      action: "resume",
      path: `/api/v1/platform/tenants/${tenantId}/resume`,
      handler: () => resumePost,
      mockFn: () => mockResumeTenant,
    },
    {
      action: "archive",
      path: `/api/v1/platform/tenants/${tenantId}/archive`,
      handler: () => archivePost,
      mockFn: () => mockArchiveTenant,
    },
  ])("$action", ({ path, handler, mockFn }) => {
    it("requires platform.tenant.manage", async () => {
      const response = await handler()(createLifecycleRequest(path), routeContext);
      const body = (await response.json()) as { data: { id: string } };

      expect(response.status).toBe(200);
      expect(body.data.id).toBe(tenantId);
      expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredPermission: "platform.tenant.manage",
        }),
      );
      expect(mockFn()).toHaveBeenCalledTimes(1);
    });

    it("requires Idempotency-Key", async () => {
      const response = await handler()(
        createLifecycleRequest(path, { "idempotency-key": "" }),
        routeContext,
      );
      const body = (await response.json()) as {
        error: { code: string };
      };

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mockFn()).not.toHaveBeenCalled();
    });

    it("requires a platform reason", async () => {
      const response = await handler()(
        createLifecycleRequest(path, {
          [ATLAS_PLATFORM_REASON_HEADER]: "",
        }),
        routeContext,
      );
      const body = (await response.json()) as {
        error: { code: string };
      };

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mockFn()).not.toHaveBeenCalled();
    });
  });

  it("writes audit entries and publishes outbox events during suspend", async () => {
    const { suspendTenant } = await getRealLifecycleFns();
    mockSuspendTenant.mockImplementation(suspendTenant);
    updateTenantStateMock.mockResolvedValueOnce({
      id: tenantId,
      previous_state: "ACTIVE",
      state: "SUSPENDED",
    });

    await suspendPost(
      createLifecycleRequest(`/api/v1/platform/tenants/${tenantId}/suspend`),
      routeContext,
    );

    expect(mockAuditWriterWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId }),
      expect.objectContaining({
        action: "tenant.state_changed",
        before: { state: "ACTIVE" },
        after: { state: "SUSPENDED" },
      }),
    );
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "tenant.state_changed",
        payload: {
          tenantId,
          from: "ACTIVE",
          to: "SUSPENDED",
        },
      }),
    );
  });

  it("tenant state gate sees suspended tenant after suspend", async () => {
    const { suspendTenant } = await getRealLifecycleFns();
    mockSuspendTenant.mockImplementation(suspendTenant);
    updateTenantStateMock.mockResolvedValueOnce({
      id: tenantId,
      previous_state: "ACTIVE",
      state: "SUSPENDED",
    });
    readPlatformTenantDetailMock.mockResolvedValueOnce(suspendedTenantDetail);

    const response = await suspendPost(
      createLifecycleRequest(`/api/v1/platform/tenants/${tenantId}/suspend`),
      routeContext,
    );
    const body = (await response.json()) as { data: { state: string } };

    expect(response.status).toBe(200);
    expect(body.data.state).toBe("SUSPENDED");
    expect(() => assertTenantActive("SUSPENDED")).toThrow("Tenant unavailable");
  });
});
