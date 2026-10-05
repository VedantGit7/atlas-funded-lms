import { AtlasHttpError } from "@atlas/core/http/errors";

export function attemptNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Attempt not found.",
  });
}

export function attemptNotInProgress(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Attempt is not in progress.",
  });
}

export function attemptTimeExpired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Attempt time limit has expired.",
  });
}

export function attemptLimitReached(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Maximum attempts allowed for this assessment have been reached.",
  });
}

export function assessmentNotPublished(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Assessment not found.",
  });
}

export function invalidAttemptItem(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Item does not belong to this attempt.",
  });
}

/** 409: the key already started a different attempt (another learner or assessment). Audit M2. */
export function attemptKeyConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "IDEMPOTENCY_CONFLICT",
    status: 409,
    message:
      "This Idempotency-Key was already used for a different request. Use a new key for a new operation.",
  });
}
