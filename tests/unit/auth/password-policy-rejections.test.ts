import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loginWithPassword,
  setPasswordFromInvitationSession,
  signupWithPassword,
} from "../../../backend/packages/auth/src/public-auth.service";
import { changePassword } from "../../../backend/packages/auth/src/account-security.service";
import { completePasswordResetAction } from "../../../frontend/apps/web/src/app/(auth)/reset-password/_actions/reset-password-action";
import { setInvitationPasswordAction } from "../../../frontend/apps/web/src/app/(auth)/invite/accept/_actions/accept-invitation-action";
import { ServerPublicApiError } from "../../../frontend/apps/web/src/lib/server/public-auth-fetch";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  setSession: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  upsert: vi.fn(),
  redirect: vi.fn(),
  setInvitationPassword: vi.fn(),
}));
vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({ auth: mocks }),
}));
vi.mock("../../../backend/packages/auth/src/supabase-user-client", () => ({
  requireSupabaseUserClient: async () => ({
    supabase: { auth: mocks },
    email: "learner@example.test",
  }),
}));
vi.mock("../../../backend/packages/auth/src/auth-principal.repository", () => ({
  upsertAuthPrincipal: mocks.upsert,
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../frontend/apps/web/src/lib/server/public-auth-fetch", () => ({
  serverPublicApi: { setInvitationPassword: mocks.setInvitationPassword },
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

const safeMessage =
  "This password does not meet security requirements. Choose a stronger, unique password.";
const providerMessage = "private-provider-detail: learner@example.test password-value";
const rejected = (code: string) => ({
  data: { user: null, session: null },
  error: { code, message: providerMessage, status: 422 },
});
const db = { $queryRaw: vi.fn() };
const signup = () =>
  signupWithPassword({
    db,
    input: { email: "learner@example.test", password: "new-password" },
  });
const invitation = () =>
  setPasswordFromInvitationSession({
    db,
    accessToken: "fixture-access",
    refreshToken: "fixture-refresh",
    password: "new-password",
  });
const account = () =>
  changePassword({ currentPassword: "old-password", newPassword: "new-password" });
function reset() {
  const form = new FormData();
  form.set("password", "new-password");
  form.set("accessToken", "fixture-access");
  form.set("refreshToken", "fixture-refresh");
  return completePasswordResetAction(null, form);
}
function invitationAction() {
  const form = new FormData();
  form.set("token", "fixture-invitation-token-long-enough");
  form.set("password", "new-password");
  form.set("accessToken", "fixture-access");
  form.set("refreshToken", "fixture-refresh");
  return setInvitationPasswordAction(null, form);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setSession.mockResolvedValue({ error: null });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("safe password policy rejection handling", () => {
  it("invitation password action preserves only the exact safe backend policy rejection", async () => {
    mocks.setInvitationPassword.mockRejectedValue(
      new ServerPublicApiError("VALIDATION_ERROR", 400, "fixture-request", safeMessage),
    );
    await expect(invitationAction()).resolves.toEqual({
      ok: false,
      message: safeMessage,
      requestId: "fixture-request",
    });
  });

  it.each([
    ["VALIDATION_ERROR", 400, providerMessage],
    ["INTERNAL_ERROR", 500, safeMessage],
    ["VALIDATION_ERROR", 500, safeMessage],
  ])(
    "invitation password action keeps other backend errors generic (%s, %s)",
    async (code, status, message) => {
      mocks.setInvitationPassword.mockRejectedValue(
        new ServerPublicApiError(
          code as string,
          status as number,
          "fixture-request",
          message as string,
        ),
      );
      await expect(invitationAction()).resolves.toEqual({
        ok: false,
        message: "Unable to accept invitation. Please contact your administrator.",
        requestId: "fixture-request",
      });
    },
  );

  for (const [name, invoke, update] of [
    ["signup", signup, false],
    ["invitation", invitation, true],
    ["account password change", account, true],
  ] as const) {
    it(`${name} explains exact weak_password rejection without provider details or success`, async () => {
      (update ? mocks.updateUser : mocks.signUp).mockResolvedValue(rejected("weak_password"));
      await expect(invoke()).rejects.toMatchObject({
        status: 400,
        code: "VALIDATION_ERROR",
        message: safeMessage,
      });
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.getSession).not.toHaveBeenCalled();
    });

    it(`${name} keeps unknown errors generic even when provider text claims a weak password`, async () => {
      (update ? mocks.updateUser : mocks.signUp).mockResolvedValue({
        ...rejected("unknown_error"),
        error: { code: "unknown_error", message: `weak_password ${providerMessage}` },
      });
      await expect(invoke()).rejects.toMatchObject({
        message:
          name === "account password change"
            ? "Unable to complete this security action. Please try again."
            : "Invalid email or password",
      });
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.getSession).not.toHaveBeenCalled();
    });
  }

  it("reset explains weak_password without redirecting or exposing provider text", async () => {
    mocks.updateUser.mockResolvedValue(rejected("weak_password"));
    await expect(reset()).resolves.toMatchObject({ ok: false, message: safeMessage });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("reset keeps unknown provider errors generic", async () => {
    mocks.updateUser.mockResolvedValue(rejected("unknown_error"));
    await expect(reset()).resolves.toMatchObject({
      ok: false,
      message: "Unable to reset password. Request a new link.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("reset rejects an invalid recovery session before attempting to change the password", async () => {
    mocks.setSession.mockResolvedValue(rejected("weak_password"));
    mocks.updateUser.mockResolvedValue({ error: null });
    await expect(reset()).resolves.toMatchObject({
      ok: false,
      message: "Reset link is invalid or expired.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("successful reset lets Next's redirect escape instead of presenting a failure", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    await expect(reset()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("login remains generic even if the provider returns weak_password", async () => {
    mocks.signInWithPassword.mockResolvedValue(rejected("weak_password"));
    await expect(
      loginWithPassword({ db, input: { email: "learner@example.test", password: "old-password" } }),
    ).rejects.toMatchObject({ status: 401, message: "Invalid email or password" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("account reauthentication failure remains generic and never changes the password", async () => {
    mocks.signInWithPassword.mockResolvedValue(rejected("weak_password"));
    await expect(account()).rejects.toMatchObject({
      message: "Unable to complete this security action. Please try again.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("invitation session failure remains generic and never changes the password", async () => {
    mocks.setSession.mockResolvedValue(rejected("weak_password"));
    await expect(invitation()).rejects.toMatchObject({ message: "Invalid email or password" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
