import { AtlasHttpError } from "@atlas/core/http/errors";

export function gradingTaskNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Grading task not found.",
  });
}

export function gradingTaskNotGradeable(
  message = "Grading task is not awaiting grading.",
): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}

export function gradingScoreOutOfRange(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Score must be between 0 and the maximum possible points.",
  });
}

export function gradingAssignedToAllDenied(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "You do not have permission to view all grading tasks.",
  });
}
