import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
  tenantDomainStatus: "ACTIVE" as const,
  requestId: "req-login",
  host: "tenant-a.example.com",
  tenantDomainId: "domain-a",
};

const {
  mockResolveTenant,
  mockLoginWithPassword,
  mockFindMembership,
  mockBuildPublicAuthResponse,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockRejectClientTenantId,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockLoginWithPassword: vi.fn(),
  mockFindMembership: vi.fn(),
  mockBuildPublicAuthResponse: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn().mockResolvedValue([]) }),
  ),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
  mockRejectClientTenantId: vi.fn(),
}));

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    loginWithPassword: (...args: unknown[]) => mockLoginWithPassword(...args),
    setAuthCookies: vi.fn(),
  };
});

vi.mock("@atlas/membership", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    findMembershipByPrincipal: (...args: unknown[]) => mockFindMembership(...args),
  };
});

vi.mock("@atlas/domain-identity", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    rejectClientTenantId: (...args: unknown[]) => mockRejectClientTenantId(...args),
    buildPublicAuthResponse: (...args: unknown[]) => mockBuildPublicAuthResponse(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

import { POST } from "../../apps/web/src/app/api/v1/public/auth/login/route";

function createRequest(body: object) {
  return new NextRequest("https://tenant-a.example.com/api/v1/public/auth/login", {
    method: "POST",
    headers: { host: "tenant-a.example.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/public/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockLoginWithPassword.mockResolvedValue({
      status: "signed_in",
      identity: { mfaEnabled: false },
      session: {
        accessToken: "access",
        refreshToken: "refresh",
        expiresIn: 3600,
      },
    });
    mockFindMembership.mockResolvedValue({
      id: "membership-a",
      status: "ACTIVE",
    });
    mockBuildPublicAuthResponse.mockResolvedValue({
      data: { status: "AUTHENTICATED", redirectTo: "/admin" },
    });
  });

  it("authenticates ACTIVE members with generic-safe success envelope", async () => {
    const response = await POST(
      createRequest({ email: "user@example.com", password: "password123" }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { status: "AUTHENTICATED", redirectTo: "/admin" } });
    expect(mockRejectClientTenantId).toHaveBeenCalled();
  });

  it("rejects spoofed tenant_id before auth", async () => {
    const { AtlasHttpError } = await import("@atlas/core/http/errors");
    mockRejectClientTenantId.mockImplementation(() => {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Invalid request",
      });
    });

    const response = await POST(
      createRequest({
        email: "user@example.com",
        password: "password123",
        tenant_id: "spoofed",
      }),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
