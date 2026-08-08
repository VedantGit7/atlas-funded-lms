import { AtlasHttpError } from "@atlas/core/http/errors";

export function automationRuleNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Automation rule not found.",
  });
}

export function automationRuleKeyConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "An automation rule with this key already exists.",
  });
}

export function automationConfigurationInvalid(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}
