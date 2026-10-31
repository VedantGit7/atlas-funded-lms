import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Launch plan task 3.2: the routes that answer for either login system. The
 * Better Auth flows themselves run against Postgres in
 * tests/integration/auth/better-auth-password-flows.test.ts.
 */

const mocks = vi.hoisted(() => ({
  provider: "supabase" as "supabase" | "better-auth",
  resetPasswordForEmail: vi.fn(),
  requestReset: vi.fn(),
  resetWithToken: vi.fn(),
  resetWithRecovery: vi.fn(),
  signOut: vi.fn(),
  sendAuthEmails: vi.fn(),
  notifyPasswordReset: vi.fn(),
}));

vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authProvider: () => mocks.provider,
  requestPasswordResetWithBetterAuth: (...args: unknown[]) => mocks.requestReset(...args),
  resetPasswordWithBetterAuth: (...args: unknown[]) => mocks.resetWithToken(...args),
  resetPasswordWithRecoverySession: (...args: unknown[]) => mocks.resetWithRecovery(...args),
  signOutWithBetterAuth: (...args: unknown[]) => mocks.signOut(...args),
}));
vi.mock("@atlas/auth/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({
    auth: { resetPasswordForEmail: (...args: unknown[]) => mocks.resetPasswordForEmail(...args) },
  }),
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
    mocks.provider = "supabase";
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.requestReset.mockResolvedValue({ emails: [resetEmail] });
    mocks.sendAuthEmails.mockResolvedValue(undefined);
  });

  it("asks Supabase to send its link back to this host's reset page", async () => {
    const response = await forgotPassword(
      request("/api/v1/public/auth/forgot-password", { email: "Owner@Example.test" }),
    );

    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith("owner@example.test", {
      redirectTo: "http://academy.localhost.test:3000/reset-password",
    });
    expect(mocks.requestReset).not.toHaveBeenCalled();
  });

  it("with Better Auth, sends the reset email itself", async () => {
    mocks.provider = "better-auth";
    const response = await forgotPassword(
      request("/api/v1/public/auth/forgot-password", { email: "owner@example.test" }),
    );

    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(mocks.requestReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@example.test" }),
    );
    expect(mocks.sendAuthEmails).toHaveBeenCalledWith(
      expect.objectContaining({ emails: [resetEmail] }),
    );
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("answers the same when nothing was sent", async () => {
    mocks.provider = "better-auth";
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
    mocks.provider = "supabase";
    mocks.signOut.mockResolvedValue({ setCookies: [] });
  });

  it("clears every Atlas session cookie", async () => {
    const response = await logout(request("/api/v1/public/auth/logout", {}));

    expect(await response.json()).toEqual({ data: { ok: true } });
    const cleared = response.headers.getSetCookie().map((cookie) => cookie.split("=")[0]);
    expect(cleared).toEqual(
      expect.arrayContaining([
        "atlas_access_token",
        "atlas_refresh_token",
        "atlas_session_persistent",
        "atlas_session",
        "__Secure-atlas_session",
      ]),
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("with Better Auth, deletes the session first", async () => {
    mocks.provider = "better-auth";
    await logout(request("/api/v1/public/auth/logout", {}, "atlas_session=opaque.signature"));

    expect(mocks.signOut).toHaveBeenCalledWith({
      ctx: expect.objectContaining({ cookie: "atlas_session=opaque.signature" }) as unknown,
    });
  });
});

describe("POST /api/v1/public/auth/reset-password with Better Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.provider = "better-auth";
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
      expect.objectContaining({
        who: { principalId: "principal-1" },
        email: "owner@example.test",
      }),
    );
    expect(mocks.resetWithRecovery).not.toHaveBeenCalled();
  });

  it("refuses a Supabase recovery session instead of a token", async () => {
    const response = await resetPassword(
      request("/api/v1/public/auth/reset-password", {
        password: "a-new-strong-password",
        accessToken: "recovery-access",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.resetWithToken).not.toHaveBeenCalled();
  });

  it("refuses a request with neither", async () => {
    const response = await resetPassword(
      request("/api/v1/public/auth/reset-password", { password: "a-new-strong-password" }),
    );
    expect(response.status).toBe(400);
  });
});
