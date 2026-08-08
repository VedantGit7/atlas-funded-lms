import { AtlasHttpError } from "@atlas/core/http/errors";

export function subSchoolNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Sub-school not found.",
  });
}

export function duplicateSubSchoolKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A sub-school with this URL already exists.",
  });
}

export function duplicateSubSchoolEmail(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A sub-school with this email already exists.",
  });
}
