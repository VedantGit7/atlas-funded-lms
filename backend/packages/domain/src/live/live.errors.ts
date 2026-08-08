import { AtlasHttpError } from "@atlas/core/http/errors";

export function liveSessionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live session not found.",
  });
}
