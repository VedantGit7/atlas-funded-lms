import { AtlasHttpError } from "@atlas/core/http/errors";

export function customFieldDefinitionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Custom field definition not found.",
  });
}
