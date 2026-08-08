import { AtlasHttpError } from "@atlas/core/http/errors";

export function practiceSessionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Practice session not found.",
  });
}

export function practiceSessionNotStarted(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Practice session is not in progress.",
  });
}

export function practiceSessionAlreadyCompleted(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Practice session is already completed.",
  });
}

export function invalidPracticeItem(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Item does not belong to this practice session.",
  });
}

export function duplicatePracticeResponse(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A response for this card was already recorded.",
  });
}

export function practiceCollectionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Collection not found.",
  });
}

export function practiceIncompleteSession(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "All cards must be answered before completing the session.",
  });
}

export function noEligiblePracticeItems(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "No eligible swipe cards are available for this session.",
  });
}

export function practiceSessionExpired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This timed test has expired. Submit it to see your score.",
  });
}
