import { AtlasHttpError } from "@atlas/core/http/errors";

export function productCopyUnsupported(productType: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: `Copying ${productType} products is not available yet.`,
  });
}

export function productCopySourceNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Source product was not found.",
  });
}

export function productCopyDestinationRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Destination product name is required.",
  });
}
