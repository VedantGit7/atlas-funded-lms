import { AtlasHttpError } from "@atlas/core/http/errors";

export function reviewRequiresEnrollment(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Enroll in this course before leaving a review.",
  });
}
