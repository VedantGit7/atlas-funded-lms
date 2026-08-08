import { AtlasHttpError } from "@atlas/core/http/errors";

export function itemNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Item not found or access denied.",
  });
}

export function itemTypeNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Unknown or inactive item type.",
  });
}

export function itemCollectionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Item collection not found or access denied.",
  });
}

export function itemCollectionSlugConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A collection with this slug already exists.",
  });
}

export function collectionItemConflict(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}

export function duplicateDimensionWeight(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Duplicate dimensionId in weights.",
  });
}
