import { AtlasHttpError } from "@atlas/core/http/errors";

export function zoomMeetingNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Zoom meeting not found.",
  });
}

export function zoomParticipantNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Zoom participant not found.",
  });
}

export function zoomParticipantMatchInvalid(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}
