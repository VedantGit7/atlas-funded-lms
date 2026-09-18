import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
  requestId: "req-confirm",
  host: "tenant-a.example.com",
  tenantDomainId: "domain-a",
  tenantDomainStatus: "ACTIVE" as const,
};

const signedInResult = {
  status: "signed_in" as const,
  identity: {
    authenticated: true as const,
    email: "user@example.com",
    emailNormalized: "user@example.com",
    mfaEnabled: false,
    globalStatus: "ACTIVE",
  },
  displayName: "Atlas User",
  session: { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 },
};

const {
  mockResolveTenant,
  mockEstablishSessionFromTokenHash,
  mockSetAuthCookies,
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
    mockEstablishSessionFromTokenHash: vi.fn(),
    mockSetAuthCookies: vi.fn(),
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

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    establishSessionFromTokenHash: (...args: unknown[]) =>
      mockEstablishSessionFromTokenHash(...args),
    setAuthCookies: (...args: unknown[]) => mockSetAuthCookies(...args),
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

import { POST } from "../../backend/apps/api/src/app/api/v1/public/auth/confirm/route";

function createRequest(body: object) {
  return new NextRequest("https://tenant-a.example.com/api/v1/public/auth/confirm", {
    method: "POST",
    headers: { host: "tenant-a.example.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = { tokenHash: "token-hash-abc", type: "signup" };

describe("POST /api/v1/public/auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockGlobalQueryRaw.mockResolvedValue([{ id: "principal-id" }]);
    mockFindMembership.mockResolvedValue(null);
    mockEnsureSelfServiceLearnerMembership.mockResolvedValue({
      membershipId: "new-membership",
      created: true,
    });
    mockEstablishSessionFromTokenHash.mockResolvedValue(signedInResult);
    mockBuildPublicAuthResponse.mockResolvedValue({
      data: { status: "AUTHENTICATED", redirectTo: "/" },
    });
  });

  it("provisions a learner membership and issues session cookies on first verification", async () => {
    mockFindMembership
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "new-membership", status: "ACTIVE" });

    const response = await POST(createRequest(validBody));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(mockEstablishSessionFromTokenHash).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: "token-hash-abc",
        type: "signup",
      }),
    );
    expect(mockEnsureSelfServiceLearnerMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA.tenantId,
        authPrincipalId: "principal-id",
        email: "user@example.com",
        displayName: "Atlas User",
      }),
    );
    expect(mockSetAuthCookies).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "access",
        refreshToken: "refresh",
        expiresInSeconds: 3600,
      }),
    );
    expect(body).toEqual({ data: { status: "AUTHENTICATED", redirectTo: "/" } });
  });

  it("does not re-provision when the member already has a membership", async () => {
    mockFindMembership.mockResolvedValue({ id: "existing-membership", status: "ACTIVE" });

    await POST(createRequest(validBody));

    expect(mockEnsureSelfServiceLearnerMembership).not.toHaveBeenCalled();
    expect(mockSetAuthCookies).toHaveBeenCalled();
  });

  it("rejects a request missing the token hash", async () => {
    const response = await POST(createRequest({ type: "signup" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockEstablishSessionFromTokenHash).not.toHaveBeenCalled();
  });

  it("rejects an unsupported OTP type", async () => {
    const response = await POST(createRequest({ tokenHash: "abc", type: "sms" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockEstablishSessionFromTokenHash).not.toHaveBeenCalled();
  });
});
