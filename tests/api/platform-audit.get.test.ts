import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";

const {
  mockRequirePlatformPrincipal,
  mockReadPlatformAuditLog,
  mockWithGlobalDb,
  mockWithPlatformScope,
  mockResolveTenant,
  mockRequireActiveMembership,
} = vi.hoisted(() => ({
  mockRequirePlatformPrincipal: vi.fn(),
  mockReadPlatformAuditLog: vi.fn(),
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

vi.mock("@atlas/audit", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readPlatformAuditLog: (...args: unknown[]) => mockReadPlatformAuditLog(...args),
  };
});

import { GET } from "../../backend/apps/api/src/app/api/v1/platform/audit/route";

const platformPrincipal = {
  platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
  platformPermissions: ["platform.audit.read"],
};

const auditPayload = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000011",
      occurredAt: "2025-01-01T00:00:00.000Z",
      action: "platform.scope.enter",
      targetType: "platform_scope",
      targetId: null,
      actorMembershipId: null,
      platformPrincipalId: platformPrincipal.platformPrincipalId,
      requestId: "req-platform-1",
      reason: "Reviewing platform audit trail",
      metadata: null,
    },
  ],
  page: {
    hasMore: false,
    nextCursor: null,
  },
};

function createRequest(path = "/api/v1/platform/audit", headers: Record<string, string> = {}) {
  return new NextRequest(`https://platform.example.com${path}`, {
    headers: {
      host: "platform.example.com",
      authorization: "Bearer platform-token",
      [ATLAS_PLATFORM_REASON_HEADER]: "Reviewing platform audit trail for compliance",
      ...headers,
    },
  });
}

describe("GET /api/v1/platform/audit", () => {
  beforeEach(() => {
    mockRequirePlatformPrincipal.mockReset();
    mockReadPlatformAuditLog.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithPlatformScope.mockClear();
    mockResolveTenant.mockReset();
    mockRequireActiveMembership.mockReset();

    mockRequirePlatformPrincipal.mockResolvedValue(platformPrincipal);
    mockReadPlatformAuditLog.mockResolvedValue(auditPayload);
  });

  it("lets a platform principal with platform.audit.read list platform audit logs", async () => {
    const response = await GET(createRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(auditPayload);
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.audit.read",
      }),
    );
    expect(mockReadPlatformAuditLog).toHaveBeenCalledTimes(1);
  });

  it("denies requests missing a platform reason", async () => {
    const response = await GET(
      createRequest("/api/v1/platform/audit", {
        [ATLAS_PLATFORM_REASON_HEADER]: "",
      }),
    );
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockReadPlatformAuditLog).not.toHaveBeenCalled();
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
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("does not grant platform access through tenant membership resolution", async () => {
    await GET(createRequest());

    expect(mockResolveTenant).not.toHaveBeenCalled();
    expect(mockRequireActiveMembership).not.toHaveBeenCalled();
    expect(mockRequirePlatformPrincipal).toHaveBeenCalledTimes(1);
  });
});
