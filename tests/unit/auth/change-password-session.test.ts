import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Changing a password must leave the signed-in session as it was. Checking the
 * current password by signing in on the user's own client swapped its aal2
 * session for an aal1 one, so Supabase refused the update for every account
 * with MFA (insufficient_aal; staging, 30 October 2026).
 */
const mocks = vi.hoisted(() => ({
  user: {
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
  },
  verifier: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabasePublicServerClient: () => ({ auth: mocks.verifier }),
}));
vi.mock("../../../backend/packages/auth/src/supabase-user-client", () => ({
  requireSupabaseUserClient: async () => ({
    supabase: { auth: mocks.user },
    email: "owner@example.test",
    userId: "user-id",
  }),
}));
vi.mock("../../../backend/packages/auth/src/password-policy", () => ({
  assertPasswordNotBreached: vi.fn(async () => undefined),
}));

import { changePassword } from "../../../backend/packages/auth/src/account-security.service";

const change = () =>
  changePassword({ currentPassword: "current-password", newPassword: "next-password-123" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifier.signInWithPassword.mockResolvedValue({ error: null });
  mocks.verifier.signOut.mockResolvedValue({ error: null });
  mocks.user.updateUser.mockResolvedValue({ error: null });
});

describe("changePassword", () => {
  it("checks the current password on its own client and updates on the user's session", async () => {
    await expect(change()).resolves.toEqual({ ok: true, email: "owner@example.test" });

    expect(mocks.verifier.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: "owner@example.test",
      password: "current-password",
    });
    expect(mocks.user.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.user.updateUser).toHaveBeenCalledExactlyOnceWith({
      password: "next-password-123",
    });
    expect(mocks.verifier.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("refuses a wrong current password without updating anything", async () => {
    mocks.verifier.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials", status: 400 },
    });

    await expect(change()).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(mocks.user.updateUser).not.toHaveBeenCalled();
  });
});
