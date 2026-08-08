import { AtlasHttpError } from "@atlas/core/http/errors";

/** Used for both "missing" and "not yours" so deck existence is never leaked. */
export function deckNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Deck not found or access denied.",
  });
}

export function deckItemNotEligible(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "That item cannot be added to a practice deck.",
  });
}

export function deckItemAlreadyAdded(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "That item is already in this deck.",
  });
}
