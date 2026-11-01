import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePlatformPrincipal: vi.fn(),
  listMfaFactors: vi.fn(),
  enrollMfaTotp: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  applyVerifiedSessionToCookieStore: vi.fn(),
  withGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  withPlatformScope: vi.fn((_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mocks.requirePlatformPrincipal(...args),
}));
vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listMfaFactors: mocks.listMfaFactors,
  enrollMfaTotp: mocks.enrollMfaTotp,
  verifyMfaEnrollment: mocks.verifyMfaEnrollment,
}));
vi.mock("@atlas/auth/cookie-store", () => ({
  applyVerifiedSessionToCookieStore: mocks.applyVerifiedSessionToCookieStore,
  readSessionPersistenceFromStore: () => Promise.resolve(true),
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mocks.withGlobalDb(fn),
}));
vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withPlatformScope: mocks.withPlatformScope,
}));

import { GET, POST } from "../../backend/apps/api/src/app/api/v1/platform/me/security/mfa/route";
import { POST as VERIFY } from "../../backend/apps/api/src/app/api/v1/platform/me/security/mfa/verify/route";

const principalId = "018f0000-0000-7000-8000-000000000010";
const factorId = "018f0000-0000-7000-8000-000000000030";

function request(path: string, init: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`https://platform.example.com${path}`, {
    method: init.method ?? "GET",
    headers: {
      host: "platform.example.com",
      origin: "https://platform.example.com",
      authorization: "Bearer platform-token",
      "content-type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

describe("platform MFA enrollment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: principalId,
      platformPermissions: ["platform.tenant.read"],
    });
  });

  it("lists factors, asking the principal check to allow a first enrollment", async () => {
    mocks.listMfaFactors.mockResolvedValue({ factors: [] });
    const response = await GET(request("/api/v1/platform/me/security/mfa"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { factors: [] } });
    expect(mocks.requirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: "platform.tenant.read",
        allowMfaEnrollment: true,
      }),
    );
  });

  it("starts a TOTP enrollment", async () => {
    mocks.enrollMfaTotp.mockResolvedValue({
      factorId,
      qrCode: "<svg/>",
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/Atlas:operator?secret=JBSWY3DPEHPK3PXP",
    });
    const response = await POST(
      request("/api/v1/platform/me/security/mfa", { method: "POST", body: {} }),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { factorId: string } }).data.factorId).toBe(
      factorId,
    );
    expect(mocks.requirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ allowMfaEnrollment: true }),
    );
  });

  it("verifies the factor and keeps the aal2 session it produced", async () => {
    const session = { accessToken: "at", refreshToken: "rt", expiresIn: 3600 };
    mocks.verifyMfaEnrollment.mockResolvedValue({ ok: true, session });
    const response = await VERIFY(
      request("/api/v1/platform/me/security/mfa/verify", {
        method: "POST",
        body: { factorId, code: "123456" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.verifyMfaEnrollment).toHaveBeenCalledWith({ factorId, code: "123456" });
    expect(mocks.applyVerifiedSessionToCookieStore).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "at", refreshToken: "rt", expiresIn: 3600 }),
    );
  });

  it("answers the principal check's refusal unchanged", async () => {
    const { AtlasHttpError } = await import("@atlas/core/http/errors");
    mocks.requirePlatformPrincipal.mockRejectedValue(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "Platform access denied.",
      }),
    );
    const response = await GET(request("/api/v1/platform/me/security/mfa"));
    expect(response.status).toBe(403);
    expect(mocks.listMfaFactors).not.toHaveBeenCalled();
  });
});
