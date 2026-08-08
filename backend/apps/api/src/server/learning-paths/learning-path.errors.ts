import { AtlasHttpError } from "@atlas/core/http/errors";

export function learningPathNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Learning path not found or access denied.",
  });
}

export function learningPathSlugConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A learning path with this slug already exists.",
  });
}

export function learningPathEnrollmentDenied(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "You do not have access to enroll in this learning path.",
  });
}

export function learningPathWorkflowNotConfigured(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Learning path publish workflow is not configured for this tenant.",
  });
}

export function learningPathInvalidStepReference(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function learningPathNotEditable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Learning path cannot be edited in its current state.",
  });
}

export function learningPathNotPublishable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Learning path cannot be submitted for review in its current state.",
  });
}
