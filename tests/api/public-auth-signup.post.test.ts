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
  mockRequestSignup,
  mockSendAuthEmails,
  mockWithTenantTx,
  mockRejectClientTenantId,
  mockEnforceAddressRateLimit,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequestSignup: vi.fn(),
  mockSendAuthEmails: vi.fn(),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      $queryRaw: vi.fn().mockResolvedValue([]),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
  mockRejectClientTenantId: vi.fn(),
  mockEnforceAddressRateLimit: vi.fn(),
}));

vi.mock("@atlas/tenancy", async (importOriginal) => ({
  // Real host helpers: the redirect check resolves the request host with them.
  ...(await importOriginal<Record<string, unknown>>()),
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requestSignup: (...args: unknown[]) => mockRequestSignup(...args),
  };
});

vi.mock("@atlas/api/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enforceAddressRateLimit: (...args: unknown[]) => mockEnforceAddressRateLimit(...args),
}));

vi.mock("@atlas/domain-identity", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    rejectClientTenantId: (...args: unknown[]) => mockRejectClientTenantId(...args),
  };
});

vi.mock("../../backend/apps/api/src/lib/auth-email", () => ({
  sendAuthEmails: (...args: unknown[]) => mockSendAuthEmails(...args),
}));

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn().mockResolvedValue([]) }),
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
    mockEnforceAddressRateLimit.mockResolvedValue(undefined);
    mockSendAuthEmails.mockResolvedValue(undefined);
    mockRequestSignup.mockResolvedValue({
      status: "verification_required",
      emails: [{ kind: "complete-signup", email: "user@example.com", token: "t" }],
    });
  });

  it("emails the link that finishes the sign-up, and answers the same for every address", async () => {
    const response = await POST(
      createRequest({ email: "user@example.com", displayName: "Atlas User" }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { status: "EMAIL_VERIFICATION_REQUIRED", redirectTo: null } });
    expect(mockRequestSignup).toHaveBeenCalledWith({
      input: { email: "user@example.com", displayName: "Atlas User" },
    });
    expect(mockSendAuthEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: [{ kind: "complete-signup", email: "user@example.com", token: "t" }],
      }),
    );

    // An address with an account gets an email saying so: the answer is identical.
    mockRequestSignup.mockResolvedValue({
      status: "verification_required",
      emails: [{ kind: "account-exists", email: "user@example.com", token: "" }],
    });
    const again = await POST(
      createRequest({ email: "user@example.com", displayName: "Atlas User" }),
    );
    expect(await again.json()).toEqual(body);
  });

  // Security review 5.3, finding 1: the password is chosen from the emailed link.
  it("refuses a password at sign-up, before sending anything", async () => {
    const response = await POST(
      createRequest({ email: "user@example.com", password: "password123", displayName: "Atlas" }),
    );

    expect(response.status).toBe(400);
    expect(mockRequestSignup).not.toHaveBeenCalled();
    expect(mockSendAuthEmails).not.toHaveBeenCalled();
  });

  // Security review 5.3, finding 5.
  it("counts the sign-up against the address's own budget", async () => {
    await POST(createRequest({ email: "User@Example.com", displayName: "Atlas User" }));
    expect(mockEnforceAddressRateLimit).toHaveBeenCalledWith({
      kind: "signup-link",
      email: "user@example.com",
    });

    mockEnforceAddressRateLimit.mockRejectedValue(
      Object.assign(new Error("Too many emails to this address."), {
        code: "RATE_LIMITED",
        status: 429,
      }),
    );
    const limited = await POST(createRequest({ email: "user@example.com", displayName: "Atlas" }));
    expect(limited.status).not.toBe(200);
    expect(mockSendAuthEmails).toHaveBeenCalledTimes(1);
  });

  // The link always leads back to this academy: the API builds it from the
  // request's host, so a client can't name one.
  it.each(["https://tenant-b.example.com/auth/confirm", "https://evil.example/auth/confirm"])(
    "refuses a client-chosen confirmation link (%s), before sending anything",
    async (emailRedirectTo) => {
      const response = await POST(
        createRequest({
          email: "user@example.com",
          displayName: "Atlas User",
          emailRedirectTo,
        }),
      );

      expect(response.status).toBe(400);
      expect(mockRequestSignup).not.toHaveBeenCalled();
    },
  );
});
