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
  mockGlobalQueryRaw,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockRejectClientTenantId,
  mockEnsureSelfServiceLearnerMembership,
} = vi.hoisted(() => {
  const mockGlobalQueryRaw = vi.fn().mockResolvedValue([]);
  return {
    mockResolveTenant: vi.fn(),
    mockLoginWithPassword: vi.fn(),
    mockFindMembership: vi.fn(),
    mockBuildPublicAuthResponse: vi.fn(),
    mockGlobalQueryRaw,
    mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) =>
      fn({ $queryRaw: mockGlobalQueryRaw }),
    ),
    mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      // The signup/login routes now apply a referral for a newly provisioned
      // membership, and that repository reads through the Unsafe variants. A tx
      // stub without them throws "tx.$queryRawUnsafe is not a function", which
      // the route reports as a bare 500.
      fn({
        $queryRaw: vi.fn().mockResolvedValue([]),
        $queryRawUnsafe: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn().mockResolvedValue(0),
        $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      }),
    ),
    mockRejectClientTenantId: vi.fn(),
    mockEnsureSelfServiceLearnerMembership: vi.fn(),
  };
});

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
  resolveRequestHostFromHeaders: (headers: Headers) =>
    (headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "",
  resolvePlatformHost: (host: string) =>
    host === "platform.localhost" || host.startsWith("platform."),
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
    ensureSelfServiceLearnerMembership: (...args: unknown[]) =>
      mockEnsureSelfServiceLearnerMembership(...args),
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

import { POST } from "../../backend/apps/api/src/app/api/v1/public/auth/login/route";

function createRequest(body: object, host = "tenant-a.example.com") {
  return new NextRequest(`https://${host}/api/v1/public/auth/login`, {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/public/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRejectClientTenantId.mockImplementation(() => {});
    mockResolveTenant.mockResolvedValue(tenantA);
    mockGlobalQueryRaw.mockResolvedValue([]);
    mockEnsureSelfServiceLearnerMembership.mockResolvedValue({
      membershipId: "new-membership",
      created: true,
    });
    mockLoginWithPassword.mockResolvedValue({
      status: "signed_in",
      identity: { mfaEnabled: false },
      displayName: null,
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

  it("authenticates platform operators on the platform host without a tenant", async () => {
    const response = await POST(
      createRequest(
        { email: "operator@example.com", password: "password123" },
        "platform.localhost",
      ),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { status: "AUTHENTICATED", redirectTo: "/platform" } });
    expect(mockResolveTenant).not.toHaveBeenCalled();
    expect(mockLoginWithPassword).toHaveBeenCalled();
  });

  it("routes MFA-enabled platform operators to the MFA step", async () => {
    mockLoginWithPassword.mockResolvedValueOnce({
      status: "signed_in",
      identity: { mfaEnabled: true },
      session: { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 },
    });

    const response = await POST(
      createRequest(
        { email: "operator@example.com", password: "password123" },
        "platform.localhost",
      ),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { status: "MFA_REQUIRED", redirectTo: null } });
  });

  it("provisions a learner membership on first login when the user has none", async () => {
    mockLoginWithPassword.mockResolvedValue({
      status: "signed_in",
      identity: { mfaEnabled: false },
      displayName: "Verified Learner",
      session: { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 },
    });
    mockGlobalQueryRaw.mockResolvedValue([{ id: "principal-id" }]);
    mockFindMembership
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "new-membership", status: "ACTIVE" });
    mockBuildPublicAuthResponse.mockResolvedValue({
      data: { status: "AUTHENTICATED", redirectTo: "/" },
    });

    const response = await POST(
      createRequest({ email: "learner@example.com", password: "password123" }),
    );
    const body: unknown = await response.json();

    expect(mockEnsureSelfServiceLearnerMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA.tenantId,
        authPrincipalId: "principal-id",
        email: "learner@example.com",
        displayName: "Verified Learner",
      }),
    );
    expect(body).toEqual({ data: { status: "AUTHENTICATED", redirectTo: "/" } });
  });

  it("does not provision a membership while an MFA challenge is still pending", async () => {
    mockLoginWithPassword.mockResolvedValue({
      status: "signed_in",
      identity: { mfaEnabled: true },
      displayName: null,
      session: { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 },
    });
    mockGlobalQueryRaw.mockResolvedValue([{ id: "principal-id" }]);
    mockFindMembership.mockResolvedValue(null);
    mockBuildPublicAuthResponse.mockResolvedValue({
      data: { status: "MFA_REQUIRED", redirectTo: null },
    });

    await POST(createRequest({ email: "mfa@example.com", password: "password123" }));

    expect(mockEnsureSelfServiceLearnerMembership).not.toHaveBeenCalled();
  });

  it("does not provision when the user already has a membership", async () => {
    mockGlobalQueryRaw.mockResolvedValue([{ id: "principal-id" }]);
    mockFindMembership.mockResolvedValue({ id: "membership-a", status: "ACTIVE" });

    await POST(createRequest({ email: "user@example.com", password: "password123" }));

    expect(mockEnsureSelfServiceLearnerMembership).not.toHaveBeenCalled();
  });
});
