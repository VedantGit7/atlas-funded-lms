import { AtlasHttpError } from "@atlas/core/http/errors";

export function batchNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Batch not found.",
  });
}

export function duplicateBatchKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Batch key already exists.",
  });
}
