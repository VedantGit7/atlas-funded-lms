import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPasswordWithRecoverySession } from "../../../backend/packages/auth/src/public-auth.service";
import { completePasswordResetAction } from "../../../frontend/apps/web/src/app/(auth)/reset-password/_actions/reset-password-action";

// Supabase only changes the password of an account with a verified factor at
// aal2, and the recovery link signs in at aal1: the reset asks for the code.
const mocks = vi.hoisted(() => ({
  setSession: vi.fn(),
  updateUser: vi.fn(),
  mfa: { listFactors: vi.fn(), challengeAndVerify: vi.fn() },
  assertPasswordNotBreached: vi.fn(),
  resetPassword: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({ auth: mocks }),
}));
vi.mock("../../../backend/packages/auth/src/password-policy", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  assertPasswordNotBreached: mocks.assertPasswordNotBreached,
}));
vi.mock("../../../frontend/apps/web/src/lib/server/public-auth-fetch", () => ({
  serverPublicApi: { resetPassword: mocks.resetPassword },
  ServerPublicApiError: class extends Error {
    constructor(
      public code: string,
      public status: number,
      public requestId: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const MFA_REQUIRED =
  "Your account uses two-step verification. Enter the 6-digit code from your authenticator app to finish.";
const MFA_INVALID = "That code didn't work. Check your authenticator app and try again.";

const reset = (mfaCode?: string) =>
  resetPasswordWithRecoverySession({
    accessToken: "fixture-access",
    refreshToken: "fixture-refresh",
    password: "a-new-strong-password",
    mfaCode,
  });

const withFactor = () => {
  mocks.mfa.listFactors.mockResolvedValue({
    data: { totp: [{ id: "factor-1" }], phone: [] },
    error: null,
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setSession.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "owner@example.test" } },
    error: null,
  });
  mocks.assertPasswordNotBreached.mockResolvedValue(undefined);
  mocks.mfa.listFactors.mockResolvedValue({ data: { totp: [], phone: [] }, error: null });
  mocks.mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("resetPasswordWithRecoverySession", () => {
  it("resets an account without MFA with no code", async () => {
    await expect(reset()).resolves.toEqual({
      status: "RESET",
      supabaseUserId: "user-1",
      email: "owner@example.test",
    });
    expect(mocks.mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith({
      password: "a-new-strong-password",
    });
  });

  it("asks for the code, without trying the password, when the account has MFA", async () => {
    withFactor();
    await expect(reset()).resolves.toEqual({ status: "MFA_REQUIRED" });
    expect(mocks.mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("verifies the code before changing the password", async () => {
    withFactor();
    await expect(reset("123456")).resolves.toMatchObject({ status: "RESET" });
    expect(mocks.mfa.challengeAndVerify).toHaveBeenCalledExactlyOnceWith({
      factorId: "factor-1",
      code: "123456",
    });
    expect(mocks.mfa.challengeAndVerify.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateUser.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("changes nothing when the code is wrong", async () => {
    withFactor();
    mocks.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: new Error("invalid") });
    await expect(reset("654321")).resolves.toEqual({ status: "MFA_INVALID" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("asks for the code if Supabase still answers insufficient_aal", async () => {
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "insufficient_aal", message: "AAL2 session is required", status: 401 },
    });
    await expect(reset()).resolves.toEqual({ status: "MFA_REQUIRED" });
  });

  it("refuses an invalid recovery session before anything else", async () => {
    mocks.setSession.mockResolvedValue({ error: new Error("expired") });
    await expect(reset()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(mocks.mfa.listFactors).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a breached password before asking for the code", async () => {
    withFactor();
    mocks.assertPasswordNotBreached.mockRejectedValue(new Error("breached"));
    await expect(reset()).rejects.toThrow("breached");
    expect(mocks.mfa.listFactors).not.toHaveBeenCalled();
  });
});

function action(mfaCode?: string) {
  const form = new FormData();
  form.set("password", "a-new-strong-password");
  form.set("accessToken", "fixture-access");
  form.set("refreshToken", "fixture-refresh");
  if (mfaCode !== undefined) form.set("mfaCode", mfaCode);
  return completePasswordResetAction(null, form);
}

describe("completePasswordResetAction", () => {
  it("sends the reset to the API and returns to sign-in when it is done", async () => {
    mocks.resetPassword.mockResolvedValue({ data: { status: "RESET" } });
    await expect(action("123456")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.resetPassword).toHaveBeenCalledExactlyOnceWith({
      password: "a-new-strong-password",
      accessToken: "fixture-access",
      refreshToken: "fixture-refresh",
      mfaCode: "123456",
    });
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("sends no code while the form has not asked for one", async () => {
    mocks.resetPassword.mockResolvedValue({ data: { status: "MFA_REQUIRED" } });
    await expect(action("")).resolves.toMatchObject({
      ok: false,
      mfaRequired: true,
      message: MFA_REQUIRED,
    });
    expect(mocks.resetPassword.mock.calls[0]?.[0]).toMatchObject({ mfaCode: undefined });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("asks again when the code did not verify", async () => {
    mocks.resetPassword.mockResolvedValue({ data: { status: "MFA_INVALID" } });
    await expect(action("654321")).resolves.toMatchObject({
      ok: false,
      mfaRequired: true,
      message: MFA_INVALID,
    });
  });

  it("refuses a code that is not six digits without calling the API", async () => {
    await expect(action("12ab")).resolves.toMatchObject({
      ok: false,
      mfaRequired: true,
      message: MFA_INVALID,
    });
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});
