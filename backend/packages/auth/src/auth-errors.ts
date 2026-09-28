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

export function authProviderUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 503,
    message: "Authentication service unavailable",
    expose: false,
  });
}
