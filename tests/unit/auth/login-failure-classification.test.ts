import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  upsert: vi.fn(),
  login: vi.fn(),
}));
vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));
vi.mock("../../../backend/packages/auth/src/auth-principal.repository", () => ({
  upsertAuthPrincipal: mocks.upsert,
}));
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

import { loginWithPassword } from "../../../backend/packages/auth/src/public-auth.service";
import { loginAction } from "../../../frontend/apps/web/src/app/(auth)/login/_actions/login-action";
import { ServerPublicApiError } from "../../../frontend/apps/web/src/lib/server/public-auth-fetch";

const db = { $queryRaw: vi.fn() };
const signIn = () =>
  loginWithPassword({ db, input: { email: "learner@example.test", password: "a-password" } });
const failed = (error: unknown) => ({ data: { user: null, session: null }, error });

describe("password sign-in failures (API)", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    ["wrong password", new AuthApiError("Invalid login credentials", 400, "invalid_credentials")],
    ["unknown email", { message: "Invalid login credentials", status: 400 }],
    ["unconfirmed email", new AuthApiError("Email not confirmed", 400, "email_not_confirmed")],
    ["a provider message claiming a weak password", { message: "x", code: "weak_password" }],
  ])("keeps %s generic", async (_case, error) => {
    mocks.signInWithPassword.mockResolvedValue(failed(error));
    await expect(signIn()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("names the auth service's rate limit, which says nothing about the account", async () => {
    mocks.signInWithPassword.mockResolvedValue(
      failed(new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit")),
    );
    await expect(signIn()).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      retryAfterSeconds: 60,
    });
  });

  it.each([
    ["a network failure", new AuthRetryableFetchError("fetch failed", 0)],
    ["a server error", new AuthApiError("Internal error", 500, "unexpected_failure")],
    ["an exception from the client", new TypeError("socket closed")],
  ])("reports %s as the service being unavailable", async (_case, error) => {
    mocks.signInWithPassword.mockResolvedValue(failed(error));
    await expect(signIn()).rejects.toMatchObject({ status: 503, expose: false });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

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
