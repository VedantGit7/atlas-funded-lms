import { AtlasHttpError } from "@atlas/core/http/errors";

export function extensionPointNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Unknown or inactive extension point.",
  });
}

export function extensionRegistrationNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Extension registration not found or access denied.",
  });
}
