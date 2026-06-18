import { AtlasHttpError } from "@atlas/core/http/errors";

export function courseNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course not found or access denied.",
  });
}

export function courseEnrollmentDenied(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "You do not have access to enroll in this course.",
  });
}
