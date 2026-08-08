import { AtlasHttpError } from "@atlas/core/http/errors";

export function workflowItemNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Workflow item not found or access denied.",
  });
}

export function workflowTransitionConflict(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}
