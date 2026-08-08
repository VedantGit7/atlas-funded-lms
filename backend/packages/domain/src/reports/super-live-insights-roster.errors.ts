import { AtlasHttpError } from "@atlas/core/http/errors";

export function superLiveSessionNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live session not found.",
  });
}
