import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setAuthCookies } from "@atlas/auth";

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
    expect(mockLoginWithPassword).not.toHaveBeenCalled();
    expect(setAuthCookies).not.toHaveBeenCalled();
  });

  it.each(["tenant-a.example.com", "platform.localhost"])(
    "keeps failed authentication on %s generic and issues no session or membership",
    async (host) => {
      const { invalidCredentials } = await import("@atlas/auth/auth-errors");
      mockLoginWithPassword.mockRejectedValueOnce(invalidCredentials());
      const response = await POST(
        createRequest({ email: "user@example.com", password: "incorrect-password" }, host),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: { code: "AUTH_REQUIRED", message: "Invalid email or password" },
      });
      expect(mockWithTenantTx).not.toHaveBeenCalled();
      expect(mockEnsureSelfServiceLearnerMembership).not.toHaveBeenCalled();
      expect(setAuthCookies).not.toHaveBeenCalled();
    },
  );

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

  it("performs tenant and platform password verification without holding a database connection", async () => {
    const originalGlobal = mockWithGlobalDb.getMockImplementation();
    let held = 0;
    mockWithGlobalDb.mockImplementation(async (fn: (db: unknown) => unknown) => {
      held += 1;
      try {
        return await fn({ $queryRaw: mockGlobalQueryRaw });
      } finally {
        held -= 1;
      }
    });
    mockGlobalQueryRaw.mockImplementation(async () => {
      expect(held).toBe(1);
      return [{ id: "principal-id" }];
    });
    mockLoginWithPassword.mockImplementation(
      async ({ db }: { db: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> } }) => {
        // The real service first waits for Supabase, then mirrors its verified principal.
        expect(held).toBe(0);
        await Promise.resolve();
        await db.$queryRaw`select verified_principal`;
        return {
          status: "signed_in",
          identity: { mfaEnabled: false },
          displayName: null,
          session: { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 },
        };
      },
    );
    try {
      const tenantResponse = await POST(
        createRequest({ email: "user@example.com", password: "password123", rememberMe: true }),
      );
      expect(tenantResponse.status).toBe(200);
      expect(setAuthCookies).toHaveBeenLastCalledWith(
        expect.objectContaining({
          accessToken: "access",
          refreshToken: "refresh",
          expiresInSeconds: 3600,
          persistent: true,
        }),
      );
      const platformResponse = await POST(
        createRequest(
          { email: "operator@example.com", password: "password123" },
          "platform.localhost",
        ),
      );
      expect(platformResponse.status).toBe(200);
      expect(await platformResponse.json()).toEqual({
        data: { status: "AUTHENTICATED", redirectTo: "/platform" },
      });
      expect(held).toBe(0);
    } finally {
      if (originalGlobal) mockWithGlobalDb.mockImplementation(originalGlobal);
    }
  });

  it("completes simultaneous tenant logins through a one-connection pool without nested acquisition", async () => {
    const originalGlobal = mockWithGlobalDb.getMockImplementation();
    const originalTenant = mockWithTenantTx.getMockImplementation();
    let occupied = false;
    const waiters: Array<() => void> = [];
    async function pooled<T>(work: () => Promise<T>): Promise<T> {
      await new Promise<void>((resolve, reject) => {
        if (!occupied) {
          occupied = true;
          resolve();
          return;
        }
        const grant = () => {
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(() => {
          const index = waiters.indexOf(grant);
          if (index !== -1) waiters.splice(index, 1);
          reject(new Error("One-connection pool acquisition timed out"));
        }, 100);
        waiters.push(grant);
      });
      try {
        return await work();
      } finally {
        const next = waiters.shift();
        if (next) next();
        else occupied = false;
      }
    }
    mockGlobalQueryRaw.mockResolvedValue([{ id: "principal-id" }]);
    mockWithGlobalDb.mockImplementation((fn: (db: unknown) => unknown) =>
      pooled(async () => fn({ $queryRaw: mockGlobalQueryRaw })),
    );
    mockWithTenantTx.mockImplementation((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      pooled(async () => fn({})),
    );
    mockLoginWithPassword.mockImplementation(
      async ({ db }: { db: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> } }) => {
        await Promise.resolve();
        await db.$queryRaw`select verified_principal`;
        return {
          status: "signed_in",
          identity: { mfaEnabled: false },
          displayName: null,
          session: { accessToken: "access", refreshToken: "refresh", expiresIn: 3600 },
        };
      },
    );
    try {
      const responses = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          POST(createRequest({ email: `learner-${index}@example.com`, password: "password123" })),
        ),
      );
      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
      expect(occupied).toBe(false);
      expect(waiters).toHaveLength(0);
      expect(mockEnsureSelfServiceLearnerMembership).not.toHaveBeenCalled();
    } finally {
      if (originalGlobal) mockWithGlobalDb.mockImplementation(originalGlobal);
      if (originalTenant) mockWithTenantTx.mockImplementation(originalTenant);
    }
  });
});
