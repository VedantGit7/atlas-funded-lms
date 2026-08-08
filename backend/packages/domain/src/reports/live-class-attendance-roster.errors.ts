import { AtlasHttpError } from "@atlas/core/http/errors";

export function liveClassSessionNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live class session not found.",
  });
}
