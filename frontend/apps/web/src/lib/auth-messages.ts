export const GENERIC_LOGIN_ERROR_MESSAGE = "Invalid email or password";

/**
 * Sign-in failures that are not about the account: too many attempts from this
 * connection, or the service failing. Naming them reveals nothing a wrong
 * password could not, and "Invalid email or password" sent people to reset
 * passwords that were fine.
 */
export const LOGIN_RATE_LIMITED_MESSAGE =
  "Too many sign-in attempts. Wait a few minutes, then try again.";
export const LOGIN_UNAVAILABLE_MESSAGE =
  "Sign-in is temporarily unavailable. Please try again in a moment.";

export function loginFailureMessage(status: number): string | null {
  if (status === 429) return LOGIN_RATE_LIMITED_MESSAGE;
  if (status >= 500) return LOGIN_UNAVAILABLE_MESSAGE;
  return null;
}
export const GENERIC_SIGNUP_ERROR_MESSAGE = "Unable to create account. Please try again.";
export const GENERIC_PASSWORD_RESET_MESSAGE =
  "If an account exists for that email, you will receive reset instructions.";

/**
 * Sign-in refusals that need a different next step from "check your password"
 * (audit H6). Each is safe to show: the person has already proven the email or
 * the account's password before the API can return it.
 */
const IDENTITY_BLOCK_MESSAGES = {
  ACCOUNT_DISABLED:
    "This account has been disabled. Contact support if you think this is a mistake.",
  EMAIL_NOT_VERIFIED: "Verify your email address using the link we sent you, then sign in.",
  ACCOUNT_REVIEW_REQUIRED:
    "This email belongs to an earlier account. For your security, support must confirm the change before you can sign in. Contact support to continue.",
} as const;

export type IdentityBlockCode = keyof typeof IDENTITY_BLOCK_MESSAGES;

/** Query values for `/login?error=…`, so a redirect never carries free text. */
const IDENTITY_BLOCK_QUERY: Record<IdentityBlockCode, string> = {
  ACCOUNT_DISABLED: "account_disabled",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  ACCOUNT_REVIEW_REQUIRED: "account_review",
};

export function isIdentityBlockCode(code: string | null | undefined): code is IdentityBlockCode {
  return typeof code === "string" && Object.hasOwn(IDENTITY_BLOCK_MESSAGES, code);
}

export function identityBlockMessage(code: string | null | undefined): string | null {
  return isIdentityBlockCode(code) ? IDENTITY_BLOCK_MESSAGES[code] : null;
}

export function identityBlockQueryValue(code: IdentityBlockCode): string {
  return IDENTITY_BLOCK_QUERY[code];
}

export function identityBlockMessageFromQuery(value: string | null): string | null {
  const match = (Object.keys(IDENTITY_BLOCK_QUERY) as IdentityBlockCode[]).find(
    (code) => IDENTITY_BLOCK_QUERY[code] === value,
  );
  return match ? IDENTITY_BLOCK_MESSAGES[match] : null;
}

export function safeInvitationErrorMessage(code: string | undefined): string {
  const identityMessage = identityBlockMessage(code);
  if (identityMessage) return identityMessage;
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
