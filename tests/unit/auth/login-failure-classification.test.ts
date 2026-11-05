import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("../../../frontend/apps/web/src/lib/server/public-auth-fetch", () => ({
  serverPublicApi: { login: mocks.login },
  ServerPublicApiError: class ServerPublicApiError extends Error {
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

import { loginAction } from "../../../frontend/apps/web/src/app/(auth)/login/_actions/login-action";
import { ServerPublicApiError } from "../../../frontend/apps/web/src/lib/server/public-auth-fetch";

/**
 * A refused sign-in says only what is safe: a wrong email or password and
 * anything else about the account stay one answer, while a rate limit or an
 * outage, which say nothing about the account, are named. The API's side is in
 * tests/integration/auth/better-auth-password-flows.test.ts.
 */
describe("login form messages (web)", () => {
  const form = () => {
    const data = new FormData();
    data.set("email", "learner@example.test");
    data.set("password", "a-password");
    return data;
  };

  beforeEach(() => vi.resetAllMocks());

  it.each([
    [429, "RATE_LIMITED", "Too many sign-in attempts. Wait a few minutes, then try again."],
    [503, "INTERNAL_ERROR", "Sign-in is temporarily unavailable. Please try again in a moment."],
    [502, "NETWORK_ERROR", "Sign-in is temporarily unavailable. Please try again in a moment."],
    [504, "REQUEST_TIMEOUT", "Sign-in is temporarily unavailable. Please try again in a moment."],
    [401, "AUTH_REQUIRED", "Invalid email or password"],
    [400, "VALIDATION_ERROR", "Invalid email or password"],
  ])("answers %i (%s) with: %s", async (status, code, message) => {
    mocks.login.mockRejectedValue(new ServerPublicApiError(code, status, "req-1", "ignored"));
    await expect(loginAction(null, form())).resolves.toMatchObject({ ok: false, message });
  });
});
