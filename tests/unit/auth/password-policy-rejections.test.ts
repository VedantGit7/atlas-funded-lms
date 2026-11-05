import { beforeEach, describe, expect, it, vi } from "vitest";
import { completePasswordResetAction } from "../../../frontend/apps/web/src/app/(auth)/reset-password/_actions/reset-password-action";
import { setInvitationPasswordAction } from "../../../frontend/apps/web/src/app/(auth)/invite/accept/_actions/accept-invitation-action";
import { ServerPublicApiError } from "../../../frontend/apps/web/src/lib/server/public-auth-fetch";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  setInvitationPassword: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../frontend/apps/web/src/lib/server/public-auth-fetch", () => ({
  serverPublicApi: {
    setInvitationPassword: mocks.setInvitationPassword,
    resetPassword: mocks.resetPassword,
  },
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

function reset() {
  const form = new FormData();
  form.set("password", "new-password");
  form.set("token", "fixture-reset-token");
  return completePasswordResetAction(null, form);
}
function invitationAction() {
  const form = new FormData();
  form.set("token", "fixture-invitation-token-long-enough");
  form.set("password", "new-password");
  return setInvitationPasswordAction(null, form);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

/**
 * The API names a password-policy refusal with one fixed message (audit H6);
 * the web shows exactly that, and keeps everything else generic, so no
 * provider detail reaches the page.
 */
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

  it("reset action shows the API's policy rejection without redirecting", async () => {
    mocks.resetPassword.mockRejectedValue(
      new ServerPublicApiError("VALIDATION_ERROR", 400, "req-policy", safeMessage),
    );
    await expect(reset()).resolves.toMatchObject({ ok: false, message: safeMessage });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("reset action keeps other API errors generic", async () => {
    mocks.resetPassword.mockRejectedValue(
      new ServerPublicApiError("INTERNAL_ERROR", 500, "req-internal", providerMessage),
    );
    await expect(reset()).resolves.toMatchObject({
      ok: false,
      message: "Unable to reset password. Request a new link.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("reset action reports an invalid reset token as an expired link", async () => {
    mocks.resetPassword.mockRejectedValue(
      new ServerPublicApiError("AUTH_REQUIRED", 401, "req-auth", "Invalid email or password"),
    );
    await expect(reset()).resolves.toMatchObject({
      ok: false,
      message: "Reset link is invalid or expired.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("successful reset lets Next's redirect escape instead of presenting a failure", async () => {
    mocks.resetPassword.mockResolvedValue({ data: { status: "RESET" } });
    await expect(reset()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login");
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      password: "new-password",
      token: "fixture-reset-token",
    });
  });
});
