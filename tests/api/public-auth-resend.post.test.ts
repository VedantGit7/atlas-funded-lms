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
    mockResendSignupVerification.mockResolvedValue({ ok: true, emails: [] });
  });

  it("forwards the normalised email to the resend service", async () => {
    const response = await POST(createRequest({ email: "User@Example.com" }));

    expect(response.status).toBe(200);
    expect(mockResendSignupVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" }),
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

  // The link always leads back to this academy: the API builds it from the
  // request's host, so a client can't name one.
  it.each(["https://tenant-b.example.com/auth/confirm", "https://evil.example/auth/confirm"])(
    "refuses a client-chosen link (%s), and sends nothing",
    async (emailRedirectTo) => {
      const response = await POST(createRequest({ email: "user@example.com", emailRedirectTo }));
      const body = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(mockResendSignupVerification).not.toHaveBeenCalled();
    },
  );
});
