import { AtlasHttpError } from "@atlas/core/http/errors";

export function liveClassSessionNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live class session not found.",
  });
}

export function liveClassAttendanceMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function liveClassAttendeeNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live class attendee not found.",
  });
}

export function liveClassLearnerNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Learner attendance record not found.",
  });
}

export function liveClassSeriesNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Series attendance rollup not found.",
  });
}

export function liveClassAttendanceStatusOverrideFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}
