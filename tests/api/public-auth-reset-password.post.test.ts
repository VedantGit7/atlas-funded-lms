import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
  tenantDomainStatus: "ACTIVE" as const,
  requestId: "req-reset",
  host: "tenant-a.example.com",
  tenantDomainId: "domain-a",
};

const mocks = vi.hoisted(() => {
  const globalQueryRaw = vi.fn();
  const txQueryRaw = vi.fn();
  return {
    reset: vi.fn(),
    lookupTenantFromHost: vi.fn(),
    findMembership: vi.fn(),
    publishSecurityEvent: vi.fn(),
    recordAuditChange: vi.fn(),
    warn: vi.fn(),
    globalQueryRaw,
    txQueryRaw,
    withTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn({ $queryRaw: txQueryRaw }),
    ),
  };
});

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resetPasswordWithRecoverySession: (...args: unknown[]) => mocks.reset(...args),
}));
vi.mock("@atlas/tenancy", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  lookupTenantFromHost: (...args: unknown[]) => mocks.lookupTenantFromHost(...args),
  resolveRequestHostFromHeaders: (headers: Headers) =>
    (headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "",
}));
vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  globalDbPerStatement: { $queryRaw: mocks.globalQueryRaw },
}));
vi.mock("@atlas/membership", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findMembershipByPrincipal: (...args: unknown[]) => mocks.findMembership(...args),
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => fn({}),
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mocks.withTenantTx(ctx, fn),
}));
vi.mock("@atlas/observability/logger", async (importOriginal) => {
  const actual = await importOriginal<{ structuredLogger: object }>();
  return { ...actual, structuredLogger: { ...actual.structuredLogger, warn: mocks.warn } };
});
vi.mock("../../backend/apps/api/src/server/notifications/security-notification.service", () => ({
  publishSecurityEvent: (...args: unknown[]) => mocks.publishSecurityEvent(...args),
}));
vi.mock("../../backend/apps/api/src/server/audit-change", () => ({
  recordAuditChange: (...args: unknown[]) => mocks.recordAuditChange(...args),
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/public/auth/reset-password/route";

function request(body: object, host = "tenant-a.example.com") {
  return new NextRequest(`https://${host}/api/v1/public/auth/reset-password`, {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const body = {
  password: "a-new-strong-password",
  accessToken: "recovery-access",
  refreshToken: "recovery-refresh",
};

describe("POST /api/v1/public/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reset.mockResolvedValue({
      status: "RESET",
      supabaseUserId: "user-1",
      email: "owner@example.test",
    });
    mocks.lookupTenantFromHost.mockResolvedValue(tenantA);
    mocks.globalQueryRaw.mockResolvedValue([{ id: "principal-1" }]);
    mocks.findMembership.mockResolvedValue({ id: "membership-1", status: "ACTIVE" });
    mocks.txQueryRaw.mockResolvedValue([{ hostname: "tenant-a.example.com" }]);
    mocks.publishSecurityEvent.mockResolvedValue(undefined);
    mocks.recordAuditChange.mockResolvedValue(undefined);
  });

  it("resets and sends the password-changed email to the academy membership", async () => {
    const response = await POST(request({ ...body, mfaCode: "123456" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "RESET" } });
    expect(mocks.reset).toHaveBeenCalledExactlyOnceWith({
      accessToken: "recovery-access",
      refreshToken: "recovery-refresh",
      password: "a-new-strong-password",
      mfaCode: "123456",
    });
    expect(mocks.withTenantTx.mock.calls[0]?.[0]).toMatchObject({ tenantId: tenantA.tenantId });
    expect(mocks.recordAuditChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorMembershipId: "membership-1" }),
      expect.objectContaining({ action: "security.password_changed" }),
    );
    expect(mocks.publishSecurityEvent).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ tenantId: tenantA.tenantId, actorMembershipId: "membership-1" }),
      {
        eventType: "security.password_changed",
        membershipId: "membership-1",
        email: "owner@example.test",
        siteUrl: "https://tenant-a.example.com",
      },
    );
  });

  it.each(["MFA_REQUIRED", "MFA_INVALID"] as const)(
    "answers %s and sends no email, because nothing changed",
    async (status) => {
      mocks.reset.mockResolvedValue({ status });
      const response = await POST(request(body));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { status } });
      expect(mocks.lookupTenantFromHost).not.toHaveBeenCalled();
      expect(mocks.publishSecurityEvent).not.toHaveBeenCalled();
    },
  );

  it("sends no email for a reset on a host with no academy", async () => {
    mocks.lookupTenantFromHost.mockResolvedValue(null);
    const response = await POST(request(body, "platform.example.com"));

    expect(await response.json()).toEqual({ data: { status: "RESET" } });
    expect(mocks.withTenantTx).not.toHaveBeenCalled();
    expect(mocks.publishSecurityEvent).not.toHaveBeenCalled();
  });

  it("sends no email when the person has no active membership in the academy", async () => {
    mocks.findMembership.mockResolvedValue({ id: "membership-1", status: "INVITED" });
    const response = await POST(request(body));

    expect(await response.json()).toEqual({ data: { status: "RESET" } });
    expect(mocks.publishSecurityEvent).not.toHaveBeenCalled();
  });

  it("still answers RESET when the email cannot be queued, and logs it", async () => {
    mocks.publishSecurityEvent.mockRejectedValue(new Error("outbox down"));
    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "RESET" } });
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "auth.password_reset_notice_failed" }),
    );
  });

  it("refuses an authenticator code that is not six digits", async () => {
    const response = await POST(request({ ...body, mfaCode: "12ab" }));

    expect(response.status).toBe(400);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("refuses a client-supplied tenant id", async () => {
    const response = await POST(request({ ...body, tenant_id: tenantA.tenantId }));

    expect(response.status).toBe(400);
    expect(mocks.reset).not.toHaveBeenCalled();
  });
});
