import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRateLimitStore } from "../../../backend/packages/api/src/rate-limit-store";
import { enforceMfaAttemptRateLimit } from "../../../backend/packages/api/src/rate-limit";
import { setRateLimitStore } from "../../../backend/packages/api/src/rate-limit-store";
import {
  stepUpMfa,
  verifyMfaEnrollment,
} from "../../../backend/packages/auth/src/account-security.service";

const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  challengeAndVerify: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("../../../backend/packages/auth/src/supabase-user-client", () => ({
  requireSupabaseUserClient: async () => ({
    supabase: { auth: { mfa, getSession: mfa.getSession } },
    email: "admin@example.test",
  }),
}));

const aal2 = {
  access_token: "access-aal2",
  refresh_token: "refresh-aal2",
  expires_in: 3600,
};

beforeEach(() => {
  vi.clearAllMocks();
  mfa.getSession.mockResolvedValue({ data: { session: aal2 }, error: null });
});

describe("stepUpMfa (audit H4)", () => {
  it("verifies the enrolled factor and returns the aal2 session to set as cookies", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1" }], phone: [] }, error: null });
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });

    await expect(stepUpMfa({ code: "123456" })).resolves.toEqual({
      session: { accessToken: "access-aal2", refreshToken: "refresh-aal2", expiresIn: 3600 },
    });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
  });

  it("uses only verified factors, and the one asked for", async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1" }, { id: "f2" }], phone: [] },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    await stepUpMfa({ code: "123456", factorId: "f2" });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f2", code: "123456" });

    await expect(stepUpMfa({ code: "123456", factorId: "unverified" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("asks the user to set up an authenticator when none is verified", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [], phone: [] }, error: null });
    await expect(stepUpMfa({ code: "123456" })).rejects.toMatchObject({
      status: 409,
      message: "Set up an authenticator app before continuing.",
    });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("rejects a wrong code without returning a session", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1" }], phone: [] }, error: null });
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: new Error("invalid code") });
    await expect(stepUpMfa({ code: "000000" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("didn't work"),
    });
    expect(mfa.getSession).not.toHaveBeenCalled();
  });
});

describe("verifyMfaEnrollment", () => {
  it("returns the aal2 session, so enrolling also satisfies step-up", async () => {
    mfa.challenge.mockResolvedValue({ data: { id: "c1" }, error: null });
    mfa.verify.mockResolvedValue({ data: {}, error: null });
    await expect(verifyMfaEnrollment({ factorId: "f1", code: "123456" })).resolves.toEqual({
      ok: true,
      session: { accessToken: "access-aal2", refreshToken: "refresh-aal2", expiresIn: 3600 },
    });
  });

  it("reports a wrong code plainly", async () => {
    mfa.challenge.mockResolvedValue({ data: { id: "c1" }, error: null });
    mfa.verify.mockResolvedValue({ data: null, error: new Error("invalid") });
    await expect(verifyMfaEnrollment({ factorId: "f1", code: "000000" })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("enforceMfaAttemptRateLimit", () => {
  it("allows ten attempts per member in fifteen minutes, then refuses", async () => {
    setRateLimitStore(new MemoryRateLimitStore());
    const attempt = (actorId: string) =>
      enforceMfaAttemptRateLimit({ tenantId: "tenant-1", actorId, requestId: "r" });
    for (let index = 0; index < 10; index += 1)
      await expect(attempt("member-1")).resolves.toBeUndefined();
    await expect(attempt("member-1")).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    // Another member's budget is untouched.
    await expect(attempt("member-2")).resolves.toBeUndefined();
    setRateLimitStore(null);
  });
});
