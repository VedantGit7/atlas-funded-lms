import { AtlasHttpError } from "@atlas/core/http/errors";

export function iapValidationError(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function iapNotConfiguredError(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function iapVerificationFailedError(
  message = "In-app purchase verification failed.",
): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function iapCourseNotFoundError(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course not found.",
  });
}

export function iapProductMismatchError(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Product ID does not match enabled store pricing for this course.",
  });
}
