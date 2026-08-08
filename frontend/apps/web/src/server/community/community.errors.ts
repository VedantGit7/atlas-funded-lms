import { AtlasHttpError } from "@atlas/core/http/errors";

export function communitySpaceNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Community space not found.",
  });
}

export function communitySpaceSlugConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A community space with this slug already exists.",
  });
}

export function communityPostNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Post not found.",
  });
}

export function communityCommentNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Comment not found.",
  });
}

export function communityReactionTargetInvalid(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Reaction target must be a post or comment.",
  });
}

export function privateSpacesEntitlementRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Private community spaces are not enabled for this tenant.",
  });
}
