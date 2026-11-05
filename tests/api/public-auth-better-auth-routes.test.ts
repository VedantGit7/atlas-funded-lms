import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan task 3.2: the forgot-password, reset and sign-out routes. The
 * Better Auth flows themselves run against Postgres in
 * tests/integration/auth/better-auth-password-flows.test.ts.
 */

const mocks = vi.hoisted(() => ({
  requestReset: vi.fn(),
  resetWithToken: vi.fn(),
  signOut: vi.fn(),
  sendAuthEmails: vi.fn(),
  notifyPasswordReset: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestPasswordResetWithBetterAuth: (...args: unknown[]) => mocks.requestReset(...args),
  resetPasswordWithBetterAuth: (...args: unknown[]) => mocks.resetWithToken(...args),
  signOutWithBetterAuth: (...args: unknown[]) => mocks.signOut(...args),
}));
vi.mock("../../backend/apps/api/src/lib/auth-email", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sendAuthEmails: (...args: unknown[]) => mocks.sendAuthEmails(...args),
}));
vi.mock("../../backend/apps/api/src/lib/account-security-orchestrator", () => ({
  notifyPasswordReset: (...args: unknown[]) => mocks.notifyPasswordReset(...args),
}));

import { POST as forgotPassword } from "../../backend/apps/api/src/app/api/v1/public/auth/forgot-password/route";
import { POST as logout } from "../../backend/apps/api/src/app/api/v1/public/auth/logout/route";
import { POST as resetPassword } from "../../backend/apps/api/src/app/api/v1/public/auth/reset-password/route";

function request(path: string, body: object, cookie?: string) {
  return new NextRequest(`http://academy.localhost.test:3000${path}`, {
    method: "POST",
    headers: {
      host: "academy.localhost.test:3000",
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

const resetEmail = { kind: "reset-password", email: "owner@example.test", token: "reset-token" };

describe("POST /api/v1/public/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestReset.mockResolvedValue({ emails: [resetEmail] });
    mocks.sendAuthEmails.mockResolvedValue(undefined);
  });

  it("sends the reset email itself, from this academy", async () => {
    const response = await forgotPassword(
      request("/api/v1/public/auth/forgot-password", { email: "Owner@Example.test" }),
    );

    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(mocks.requestReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@example.test" }),
    );
    expect(mocks.sendAuthEmails).toHaveBeenCalledWith(
      expect.objectContaining({ emails: [resetEmail] }),
    );
  });

  it("answers the same when nothing was sent", async () => {
    mocks.requestReset.mockResolvedValue({ emails: [] });
    const response = await forgotPassword(
      request("/api/v1/public/auth/forgot-password", { email: "nobody@example.test" }),
    );
    expect(await response.json()).toEqual({ data: { ok: true } });
  });

  it("refuses a client-supplied tenant id", async () => {
    const response = await forgotPassword(
      request("/api/v1/public/auth/forgot-password", {
        email: "owner@example.test",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/v1/public/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ setCookies: [] });
  });

  it("deletes the session, then clears the session cookie", async () => {
    const response = await logout(
      request("/api/v1/public/auth/logout", {}, "atlas_session=opaque.signature"),
    );

    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(mocks.signOut).toHaveBeenCalledWith({
      ctx: expect.objectContaining({ cookie: "atlas_session=opaque.signature" }) as unknown,
    });
    const cleared = response.headers.getSetCookie().map((cookie) => cookie.split("=")[0]);
    expect(cleared).toEqual(expect.arrayContaining(["atlas_session", "__Secure-atlas_session"]));
  });

  it("answers the same with no session", async () => {
    const response = await logout(request("/api/v1/public/auth/logout", {}));
    expect(await response.json()).toEqual({ data: { ok: true } });
  });
});

describe("POST /api/v1/public/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetWithToken.mockResolvedValue({
      principalId: "principal-1",
      email: "owner@example.test",
    });
    mocks.notifyPasswordReset.mockResolvedValue(undefined);
  });

  it("resets from the link's token and sends the security email to that principal", async () => {
    const response = await resetPassword(
      request("/api/v1/public/auth/reset-password", {
        password: "a-new-strong-password",
        token: "reset-token",
      }),
    );

    expect(await response.json()).toEqual({ data: { status: "RESET" } });
    expect(mocks.resetWithToken).toHaveBeenCalledWith(
      expect.objectContaining({ token: "reset-token", password: "a-new-strong-password" }),
    );
    expect(mocks.notifyPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ principalId: "principal-1", email: "owner@example.test" }),
    );
  });

  it("refuses a request without the link's token", async () => {
    const response = await resetPassword(
      request("/api/v1/public/auth/reset-password", { password: "a-new-strong-password" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.resetWithToken).not.toHaveBeenCalled();
  });
});
