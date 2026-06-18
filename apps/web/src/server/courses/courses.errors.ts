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

export function courseSlugConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A course with this slug already exists.",
  });
}

export function moduleNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Module not found or access denied.",
  });
}

export function moduleDeleteConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Module cannot be deleted while lessons exist.",
  });
}

export function courseWorkflowNotConfigured(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Course publish workflow is not configured for this tenant.",
  });
}
