import { AtlasHttpError } from "@atlas/core/http/errors";

export function deviceSessionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Device session not found.",
  });
}
