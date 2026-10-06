import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
  requestId: "req-resend",
  host: "tenant-a.example.com",
  tenantDomainId: "domain-a",
  tenantDomainStatus: "ACTIVE" as const,
};

const { mockResolveTenant, mockResendSignupVerification, mockRejectClientTenantId } = vi.hoisted(
  () => ({
    mockResolveTenant: vi.fn(),
    mockResendSignupVerification: vi.fn(),
    mockRejectClientTenantId: vi.fn(),
  }),
);

vi.mock("@atlas/tenancy", async (importOriginal) => ({
  // Real host helpers: the redirect check resolves the request host with them.
  ...(await importOriginal<Record<string, unknown>>()),
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resendSignupVerification: (...args: unknown[]) => mockResendSignupVerification(...args),
  };
});

vi.mock("@atlas/domain-identity", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    rejectClientTenantId: (...args: unknown[]) => mockRejectClientTenantId(...args),
  };
});

import { POST } from "../../backend/apps/api/src/app/api/v1/public/auth/resend/route";

function createRequest(body: object) {
  return new NextRequest("https://tenant-a.example.com/api/v1/public/auth/resend", {
    method: "POST",
    headers: { host: "tenant-a.example.com", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/public/auth/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockResendSignupVerification.mockResolvedValue({ ok: true });
  });

  it("forwards the email and tenant redirect to the resend service", async () => {
    const response = await POST(
      createRequest({
        email: "User@Example.com",
        emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockResendSignupVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        emailRedirectTo: "https://tenant-a.example.com/auth/confirm",
      }),
    );
  });

  it("returns a uniform success response (anti-enumeration)", async () => {
    const response = await POST(createRequest({ email: "user@example.com" }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        ok: true,
        message: "If your email needs verification, a new link has been sent.",
      },
    });
  });

  it("rejects an invalid email", async () => {
    const response = await POST(createRequest({ email: "not-an-email" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockResendSignupVerification).not.toHaveBeenCalled();
  });

  it.each(["https://tenant-b.example.com/auth/confirm", "https://evil.example/auth/confirm"])(
    "refuses a link that would lead to %s, and sends nothing",
    async (emailRedirectTo) => {
      const response = await POST(createRequest({ email: "user@example.com", emailRedirectTo }));
      const body = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mockResendSignupVerification).not.toHaveBeenCalled();
    },
  );
});
