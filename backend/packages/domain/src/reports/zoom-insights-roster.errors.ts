import { AtlasHttpError } from "@atlas/core/http/errors";

export function zoomMeetingNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Zoom meeting not found.",
  });
}
