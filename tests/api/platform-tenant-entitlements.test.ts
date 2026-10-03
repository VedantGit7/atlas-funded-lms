import { createPlatformIdempotencyStore } from "../helpers/platform-idempotency-tx";
const replayStore = createPlatformIdempotencyStore();
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import type * as PlatformTenantEntitlementsModule from "@atlas/domain-tenancy/services/platform-tenant-entitlement.service";

const tenantId = "018f0000-0000-7000-8000-000000000001";

const {
  mockRequirePlatformPrincipal,
  mockReadPlatformTenantEntitlements,
  mockReplacePlatformTenantEntitlements,
  mockWithGlobalDb,
  mockResolveTenant,
  mockRequireActiveMembership,
  mockAuditWriterWrite,
  mockOutboxPublish,
  txExecuteRawMock,
  txQueryRawMock,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockReadPlatformTenantEntitlements: vi.fn(),
  mockReplacePlatformTenantEntitlements: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockResolveTenant: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockAuditWriterWrite: vi.fn(),
  mockOutboxPublish: vi.fn(),
  txExecuteRawMock: vi.fn(),
  txQueryRawMock: vi.fn(),
}));

async function getRealReplaceEntitlements() {
  const entitlements = await vi.importActual<typeof PlatformTenantEntitlementsModule>(
    "@atlas/domain-tenancy/services/platform-tenant-entitlement.service",
  );
  return entitlements.replacePlatformTenantEntitlements;
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
    withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
      fn(replayStore.wrap({ $queryRaw: txQueryRawMock, $executeRaw: txExecuteRawMock })),
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
    readPlatformTenantEntitlements: (...args: unknown[]) =>
      mockReadPlatformTenantEntitlements(...args),
    replacePlatformTenantEntitlements: (...args: unknown[]) =>
      mockReplacePlatformTenantEntitlements(...args),
  };
});

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

import {
  GET,
  PUT,
} from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/entitlements/route";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
  platformPermissions: ["platform.entitlement.manage"],
};

const entitlementsPayload = {
  data: [
    {
      key: "feature.community",
      enabled: true,
      value: null,
      expiresAt: null,
    },
  ],
};

const putBody = {
  reason: "Updating tenant entitlements for rollout",
  entitlements: [
    {
      key: "feature.community",
      enabled: true,
      value: null,
      expiresAt: null,
    },
  ],
};

const routeContext = { params: Promise.resolve({ id: tenantId }) };

function createGetRequest(headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://platform.example.com/api/v1/platform/tenants/${tenantId}/entitlements`,
    {
      headers: {
        host: "platform.example.com",
        authorization: "Bearer platform-token",
        [ATLAS_PLATFORM_REASON_HEADER]: "Reviewing tenant entitlements for support triage",
        ...headers,
      },
    },
  );
}

function createPutRequest(headers: Record<string, string> = {}, body: unknown = putBody) {
  return new NextRequest(
    `https://platform.example.com/api/v1/platform/tenants/${tenantId}/entitlements`,
    {
      method: "PUT",
      headers: {
        host: "platform.example.com",
        authorization: "Bearer platform-token",
        "content-type": "application/json",
        [ATLAS_PLATFORM_REASON_HEADER]: "Updating tenant entitlements for rollout",
        "idempotency-key": "entitlements-key-001",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

describe("GET /api/v1/platform/tenants/[id]/entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replayStore.clear();
    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockReadPlatformTenantEntitlements.mockResolvedValue(entitlementsPayload);
  });

  it("lets a platform principal with platform.entitlement.manage read tenant entitlements", async () => {
    const response = await GET(createGetRequest(), routeContext);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(entitlementsPayload);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.entitlement.manage",
      }),
    );
    expect(mockReadPlatformTenantEntitlements).toHaveBeenCalledWith(expect.anything(), tenantId);
  });

  it("requires a platform reason", async () => {
    const response = await GET(
      createGetRequest({
        [ATLAS_PLATFORM_REASON_HEADER]: "",
      }),
      routeContext,
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReadPlatformTenantEntitlements).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/platform/tenants/[id]/entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replayStore.clear();
    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockReplacePlatformTenantEntitlements.mockResolvedValue(entitlementsPayload);
    mockAuditWriterWrite.mockResolvedValue(undefined);
    mockOutboxPublish.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
    txExecuteRawMock.mockResolvedValue(1);
    txQueryRawMock.mockResolvedValue([
      {
        key: "feature.community",
        enabled: true,
        value_json: null,
        expires_at: null,
      },
    ]);
  });

  it("lets a platform principal with platform.entitlement.manage replace tenant entitlements", async () => {
    const response = await PUT(createPutRequest(), routeContext);
    const body = (await response.json()) as typeof entitlementsPayload;

    expect(response.status).toBe(200);
    expect(body).toEqual(entitlementsPayload);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.entitlement.manage",
      }),
    );
    expect(mockReplacePlatformTenantEntitlements).toHaveBeenCalledTimes(1);
  });

  it("requires a platform reason", async () => {
    const response = await PUT(
      createPutRequest({
        [ATLAS_PLATFORM_REASON_HEADER]: "",
      }),
      routeContext,
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReplacePlatformTenantEntitlements).not.toHaveBeenCalled();
  });

  it("requires Idempotency-Key", async () => {
    const response = await PUT(
      createPutRequest({
        "idempotency-key": "",
      }),
      routeContext,
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReplacePlatformTenantEntitlements).not.toHaveBeenCalled();
  });

  it("writes audit entries and publishes outbox events during entitlement replacement", async () => {
    mockReplacePlatformTenantEntitlements.mockImplementation(await getRealReplaceEntitlements());
    txQueryRawMock.mockReset();
    txQueryRawMock.mockResolvedValueOnce([]);
    txQueryRawMock.mockResolvedValueOnce([
      {
        key: "feature.community",
        value_json: true,
        expires_at: null,
      },
    ]);

    await PUT(createPutRequest(), routeContext);

    expect(txExecuteRawMock).toHaveBeenCalledTimes(2);

    expect(mockAuditWriterWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId }),
      expect.objectContaining({
        action: "config.entitlement.changed",
      }),
    );
    expect(mockOutboxPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "entitlement.changed",
        payload: expect.objectContaining({
          tenantId,
          key: "feature.community",
        }),
      }),
    );
  });

  it("does not let tenant admins self-grant entitlements through the platform route", async () => {
    mockRequirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );

    const response = await PUT(createPutRequest(), routeContext);
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReplacePlatformTenantEntitlements).not.toHaveBeenCalled();
    expect(mockResolveTenant).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
  });
});
