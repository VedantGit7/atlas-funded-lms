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

/** The question cannot be graded as written (item-definition.contract.ts). */
export function itemDefinitionInvalid(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
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

export function itemImportBatchNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Import not found or access denied.",
  });
}

/** The batch is no longer taking rows: it was completed or undone. */
export function itemImportBatchClosed(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This import is already finished. Start a new import to add more questions.",
  });
}

/** The uploaded file is not the current template for the chosen type. */
export function itemImportFileInvalid(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function itemImportBatchAlreadyUndone(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This import was already undone.",
  });
}

export function itemInUse(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message:
      "This question is used in a deck, collection or assessment, or learners have answered it, so it cannot be deleted. Archive it instead to hide it from learners.",
  });
}
