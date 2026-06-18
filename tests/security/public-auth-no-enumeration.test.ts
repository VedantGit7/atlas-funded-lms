import { describe, expect, it } from "vitest";
import { invalidCredentials } from "@atlas/auth";
import {
  GENERIC_LOGIN_ERROR_MESSAGE,
  GENERIC_PASSWORD_RESET_MESSAGE,
  GENERIC_SIGNUP_ERROR_MESSAGE,
  safeInvitationErrorMessage,
} from "@atlas/domain-identity";

describe("public auth no-enumeration", () => {
  it("uses generic invalid credentials messaging for login failures", () => {
    const error = invalidCredentials();
    expect(error.message).toBe(GENERIC_LOGIN_ERROR_MESSAGE);
    expect(error.message).not.toMatch(/not found|does not exist/i);
  });

  it("uses generic signup failure messaging", () => {
    expect(GENERIC_SIGNUP_ERROR_MESSAGE).not.toMatch(/already registered|exists/i);
  });

  it("uses generic password reset messaging", () => {
    expect(GENERIC_PASSWORD_RESET_MESSAGE).toMatch(/If an account exists/i);
  });

  it("does not leak invite validity details beyond safe copy", () => {
    expect(safeInvitationErrorMessage("INVALID_INVITATION")).not.toMatch(/used|wrong tenant/i);
  });
});
