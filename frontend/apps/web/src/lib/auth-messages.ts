export const GENERIC_LOGIN_ERROR_MESSAGE = "Invalid email or password";
export const GENERIC_SIGNUP_ERROR_MESSAGE = "Unable to create account. Please try again.";
export const GENERIC_PASSWORD_RESET_MESSAGE =
  "If an account exists for that email, you will receive reset instructions.";

export function safeInvitationErrorMessage(code: string | undefined): string {
  switch (code) {
    case undefined:
    case "INVALID_INVITATION":
      return "This invitation is invalid or has expired.";
    case "INVITATION_EMAIL_MISMATCH":
      return "Sign in with the email address that received this invitation.";
    case "AUTH_REQUIRED":
      return "Sign in or create an account to accept this invitation.";
    case "INVITATION_EXPIRED":
      return "This invitation has expired.";
    case "INVITATION_ALREADY_ACCEPTED":
      return "This invitation was already accepted.";
    case "INVITATION_REVOKED":
      return "This invitation is no longer valid.";
    default:
      return "Unable to accept invitation. Please contact your administrator.";
  }
}
