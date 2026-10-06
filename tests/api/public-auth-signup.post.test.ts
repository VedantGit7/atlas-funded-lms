import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
  requestId: "req-signup",
  host: "tenant-a.example.com",
  tenantDomainId: "domain-a",
  tenantDomainStatus: "ACTIVE" as const,
};

const {
  mockResolveTenant,
  mockSignupWithPassword,
  mockBuildPublicAuthResponse,
  mockGlobalQueryRaw,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockRejectClientTenantId,
  mockFindMembership,
  mockEnsureSelfServiceLearnerMembership,
} = vi.hoisted(() => {
  const mockGlobalQueryRaw = vi.fn().mockResolvedValue([]);
  return {
    mockResolveTenant: vi.fn(),
    mockSignupWithPassword: vi.fn(),
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
    mockFindMembership: vi.fn(),
    mockEnsureSelfServiceLearnerMembership: vi.fn(),
  };
});

vi.mock("@atlas/tenancy", async (importOriginal) => ({
  // Real host helpers: the redirect check resolves the request host with them.
  ...(await importOriginal<Record<string, unknown>>()),
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signupWithPassword: (...args: unknown[]) => mockSignupWithPassword(...args),
    setAuthCookies: vi.fn(),
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

vi.mock("@atlas/membership", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    findMembershipByPrincipal: (...args: unknown[]) => mockFindMembership(...args),
    ensureSelfServiceLearnerMembership: (...args: unknown[]) =>
      mockEnsureSelfServiceLearnerMembership(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/public/auth/signup/route";

function createRequest(body: object) {
  return new NextRequest("https://tenant-a.example.com/api/v1/public/auth/signup", {
    method: "POST",
    headers: { host: "tenant-a.example.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/public/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockGlobalQueryRaw.mockResolvedValue([]);
    mockFindMembership.mockResolvedValue(null);
    mockEnsureSelfServiceLearnerMembership.mockResolvedValue({
      membershipId: "new-membership",
      created: true,
    });
    mockSignupWithPassword.mockResolvedValue({
      status: "verification_required",
      identity: { mfaEnabled: false },
      session: undefined,
    });
    mockBuildPublicAuthResponse.mockResolvedValue({
      data: { status: "EMAIL_VERIFICATION_REQUIRED", redirectTo: null },
    });
  });

  it("returns verification_required status for signup", async () => {
    const response = await POST(
      createRequest({
        email: "user@example.com",
        password: "password123",
        displayName: "Atlas User",
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: { status: "EMAIL_VERIFICATION_REQUIRED", redirectTo: null },
    });
  });

  it("does not provision a membership while email verification is pending", async () => {
    // A principal exists but there is no session yet, so provisioning must wait
    // for the first login after verification.
    mockGlobalQueryRaw.mockResolvedValue([{ id: "principal-id" }]);

    await POST(
      createRequest({
        email: "user@example.com",
        password: "password123",
        displayName: "Atlas User",
      }),
    );

    expect(mockEnsureSelfServiceLearnerMembership).not.toHaveBeenCalled();
  });

  it("provisions a learner membership when signup returns an immediate session", async () => {
    mockSignupWithPassword.mockResolvedValue({
      status: "signed_in",
      identity: { mfaEnabled: false },
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
      createRequest({
        email: "user@example.com",
        password: "password123",
        displayName: "Atlas User",
      }),
    );
    const body: unknown = await response.json();

    expect(mockEnsureSelfServiceLearnerMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA.tenantId,
        authPrincipalId: "principal-id",
        email: "user@example.com",
        displayName: "Atlas User",
      }),
    );
    expect(body).toEqual({ data: { status: "AUTHENTICATED", redirectTo: "/" } });
  });

  it("forwards the tenant emailRedirectTo to the signup service", async () => {
    await POST(
      createRequest({
        email: "user@example.com",
        password: "password123",
        displayName: "Atlas User",
        emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
      }),
    );

    expect(mockSignupWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
        }),
      }),
    );
  });

  it.each(["https://tenant-b.example.com/auth/confirm", "https://evil.example/auth/confirm"])(
    "refuses a confirmation link that would lead to %s, before creating anything",
    async (emailRedirectTo) => {
      const response = await POST(
        createRequest({
          email: "user@example.com",
          password: "password123",
          displayName: "Atlas User",
          emailRedirectTo,
        }),
      );

      expect(response.status).toBe(400);
      expect(mockSignupWithPassword).not.toHaveBeenCalled();
    },
  );
});
