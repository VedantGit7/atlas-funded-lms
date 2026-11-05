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

export function authProviderUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 503,
    message: "Authentication service unavailable",
    expose: false,
  });
}
