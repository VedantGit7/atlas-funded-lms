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
