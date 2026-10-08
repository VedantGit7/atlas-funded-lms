import { AtlasHttpError } from "@atlas/core/http/errors";

export function authRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "AUTH_REQUIRED",
    status: 401,
    message: "Authentication required",
  });
}

export function invalidCredentials(): AtlasHttpError {
  return new AtlasHttpError({
    code: "AUTH_REQUIRED",
    status: 401,
    message: "Invalid email or password",
  });
}

export const PASSWORD_POLICY_REJECTION_MESSAGE =
  "This password does not meet security requirements. Choose a stronger, unique password.";

/** Only password writes may expose this static policy guidance, never login failures. */
export function passwordPolicyRejection(error: unknown): AtlasHttpError | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "weak_password"
  ) {
    return null;
  }
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: PASSWORD_POLICY_REJECTION_MESSAGE,
  });
}

export function authEmailRateLimited(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 429,
    message:
      "Too many verification emails were sent. Please wait a few minutes, then try again or sign in if you already verified your email.",
  });
}

/**
 * The auth service refused a sign-in for its per-IP rate limit. Says nothing
 * about the account, so unlike a refused password it can be named.
 */
export const SIGN_IN_RATE_LIMITED_MESSAGE =
  "Too many sign-in attempts. Wait a few minutes, then try again.";

export function signInRateLimited(): AtlasHttpError {
  return new AtlasHttpError({
    code: "RATE_LIMITED",
    status: 429,
    message: SIGN_IN_RATE_LIMITED_MESSAGE,
    retryAfterSeconds: 60,
  });
}

export function accountDisabled(): AtlasHttpError {
  return new AtlasHttpError({
    code: "ACCOUNT_DISABLED",
    status: 403,
    message: "This account has been disabled. Contact support if you think this is a mistake.",
  });
}

export function emailNotVerified(): AtlasHttpError {
  return new AtlasHttpError({
    code: "EMAIL_NOT_VERIFIED",
    status: 403,
    message: "Verify your email address using the link we sent you, then sign in.",
  });
}

/**
 * The email is confirmed, but it belongs to an earlier account bound to a
 * different sign-in. The earlier account's memberships and grants never move
 * automatically (audit H6); a platform operator reviews the request.
 */
export function accountReviewRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "ACCOUNT_REVIEW_REQUIRED",
    status: 409,
    message:
      "This email belongs to an earlier account. For your security, support must confirm the change before you can sign in. Contact support to continue.",
  });
}

export function authProviderUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 503,
    message: "Authentication service unavailable",
    expose: false,
  });
}
