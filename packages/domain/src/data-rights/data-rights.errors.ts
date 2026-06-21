import { AtlasHttpError } from "@atlas/core/http/errors";
import { EntitlementRequiredError } from "@atlas/authorization";

export function exportJobNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Export job not found.",
  });
}

export function deletionRequestNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Deletion request not found.",
  });
}

export function deletionRequestInvalidState(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}

export function deletionDuplicatePending(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A pending deletion request already exists for this target.",
  });
}

export function exportEntitlementRequired(): EntitlementRequiredError {
  return new EntitlementRequiredError("data.export.enable");
}

export function invalidDeletionTarget(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Deletion target is invalid.",
  });
}
