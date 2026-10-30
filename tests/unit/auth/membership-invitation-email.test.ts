import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A failed invitation email is a 503 with its own message. As a 502, a proxy
 * could swap the body for an HTML page, and the console showed a JSON parse
 * error instead (staging, 30 October 2026).
 */
const mocks = vi.hoisted(() => ({
  inviteUserByEmail: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("../../../backend/packages/auth/src/supabase-server", () => ({
  createSupabaseAdminServerClient: () => ({
    auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail } },
  }),
  createSupabasePublicServerClient: () => ({ auth: { signInWithOtp: mocks.signInWithOtp } }),
}));

import { sendTenantInvitationEmail } from "../../../backend/packages/auth/src/membership-invitation-email.service";

const send = () =>
  sendTenantInvitationEmail({
    email: "owner@example.test",
    inviteUrl: "https://academy.example.test/invite/accept?token=fixture",
  });

const unavailable = {
  status: 503,
  code: "SERVICE_UNAVAILABLE",
  message: "Unable to send the invitation email. Please try again.",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("sendTenantInvitationEmail", () => {
  it("answers a failed invite email with 503", async () => {
    mocks.inviteUserByEmail.mockResolvedValue({
      error: { message: "Error sending invite email", status: 500 },
    });

    await expect(send()).rejects.toMatchObject(unavailable);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("answers a failed sign-in link for an existing account with 503", async () => {
    mocks.inviteUserByEmail.mockResolvedValue({
      error: { message: "A user with this email address has already been registered", status: 422 },
    });
    mocks.signInWithOtp.mockResolvedValue({ error: { message: "Error sending magic link" } });

    await expect(send()).rejects.toMatchObject(unavailable);
  });

  it("sends an existing account a sign-in link to the same invitation", async () => {
    mocks.inviteUserByEmail.mockResolvedValue({
      error: { message: "A user with this email address has already been registered", status: 422 },
    });
    mocks.signInWithOtp.mockResolvedValue({ error: null });

    await expect(send()).resolves.toBeUndefined();
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "owner@example.test",
      options: { emailRedirectTo: "https://academy.example.test/invite/accept?token=fixture" },
    });
  });
});
