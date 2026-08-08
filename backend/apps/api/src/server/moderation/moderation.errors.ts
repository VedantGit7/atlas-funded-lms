import { AtlasHttpError } from "@atlas/core/http/errors";

export function moderationCaseNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Moderation case was not found.",
  });
}

export function moderationInvalidTransition(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function moderationUnregisteredContentAction(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "The requested content action is not registered.",
  });
}

export function moderationTargetNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Moderation target was not found.",
  });
}

export function appealNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Appeal was not found.",
  });
}

export function appealNotAllowed(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function appealSelfReviewBlocked(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "You cannot review your own appeal.",
  });
}

export function moderationDuplicateOpenCase(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "An open moderation case already exists for this target.",
  });
}

export function appealAlreadyOpen(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "An open appeal already exists for this case.",
  });
}
