import { AtlasHttpError } from "@atlas/core/http/errors";

export function tagNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Tag not found.",
  });
}
