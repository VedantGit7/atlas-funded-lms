import { AtlasHttpError } from "@atlas/core/http/errors";

export function courseNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course not found or access denied.",
  });
}

/** An enrolled learner opened a course that is back in draft or in review. */
export function courseBeingUpdated(): AtlasHttpError {
  return new AtlasHttpError({
    code: "COURSE_BEING_UPDATED",
    status: 409,
    message:
      "This course is being updated. Your progress is saved, and you can continue when it's back.",
  });
}

export function courseEnrollmentDenied(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "You do not have access to enroll in this course.",
  });
}

export function coursePurchaseRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PAYMENT_REQUIRED",
    status: 402,
    message: "This course requires a purchase before you can enroll.",
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
    message: "Move or trash this section's lessons first. Only an empty section can go to Trash.",
  });
}

export function courseWorkflowNotConfigured(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Course publish workflow is not configured for this tenant.",
  });
}
