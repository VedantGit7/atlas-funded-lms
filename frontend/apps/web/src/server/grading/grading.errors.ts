// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

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
