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

export function authProviderUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 503,
    message: "Authentication service unavailable",
    expose: false,
  });
}
