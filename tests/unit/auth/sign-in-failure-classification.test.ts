import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInEmail: vi.fn(), principals: vi.fn() }));
vi.mock("../../../backend/packages/auth/src/better-auth-runtime", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAtlasAuth: () => ({ api: { signInEmail: mocks.signInEmail } }),
}));

import { signInWithBetterAuth } from "../../../backend/packages/auth/src/better-auth-flows";

/**
 * Why a password sign-in failed, as far as the caller may know. A wrong email
 * or password and anything else about the account stay one generic answer, so
 * it can't reveal which accounts exist; a rate limit or an outage says nothing
 * about the account, and calling it a wrong password sent people to reset
 * passwords that were fine.
 */

/** Better Auth's errors, recognised by name as its own isAPIError does. */
function apiError(statusCode: number, code?: string): Error {
  return Object.assign(new Error(code ?? "error"), {
    name: "APIError",
    statusCode,
    body: code ? { code } : undefined,
  });
}

const db = { $queryRaw: (...args: unknown[]) => mocks.principals(...args) as Promise<never> };
const signIn = () =>
  signInWithBetterAuth({
    db,
    ctx: { host: "academy.example.test", cookie: null, userAgent: null },
    email: "learner@example.test",
    password: "a-password",
    rememberMe: false,
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.principals.mockResolvedValue([]);
});

describe("password sign-in failures", () => {
  it.each([
    ["a wrong password", apiError(401, "INVALID_EMAIL_OR_PASSWORD")],
    ["an unknown email", apiError(401)],
  ])("keeps %s generic", async (_case, error) => {
    mocks.signInEmail.mockRejectedValue(error);
    await expect(signIn()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("asks an unverified address to verify, which only its owner can see after the password", async () => {
    mocks.signInEmail.mockRejectedValue(apiError(403, "EMAIL_NOT_VERIFIED"));
    await expect(signIn()).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });

  it("names the rate limit, which says nothing about the account", async () => {
    mocks.signInEmail.mockRejectedValue(apiError(429));
    await expect(signIn()).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      retryAfterSeconds: 60,
    });
  });

  it("says a disabled account is disabled once the password was right", async () => {
    mocks.signInEmail.mockRejectedValue(apiError(403, "FAILED_TO_CREATE_SESSION"));
    mocks.principals.mockResolvedValue([{ id: "p1", global_status: "disabled" }]);
    await expect(signIn()).rejects.toMatchObject({ code: "ACCOUNT_DISABLED", status: 403 });
  });

  it.each([
    ["a server error", apiError(500)],
    ["an exception from the database", new TypeError("socket closed")],
  ])("reports %s as the service being unavailable", async (_case, error) => {
    mocks.signInEmail.mockRejectedValue(error);
    await expect(signIn()).rejects.toMatchObject({ status: 503, expose: false });
  });
});
