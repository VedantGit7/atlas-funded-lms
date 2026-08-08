import { AtlasHttpError } from "@atlas/core/http/errors";

export function lessonNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Lesson not found or access denied.",
  });
}

export function lessonEnrollmentRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Enrollment is required to access this lesson.",
  });
}

export function lessonAssetNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Lesson asset not found or access denied.",
  });
}
