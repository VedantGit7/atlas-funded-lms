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
  mockWithGlobalDb,
  mockWithTenantTx,
  mockRejectClientTenantId,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockSignupWithPassword: vi.fn(),
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

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

import { POST } from "../../apps/web/src/app/api/v1/public/auth/signup/route";

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
});
