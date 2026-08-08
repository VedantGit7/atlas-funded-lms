import { AtlasHttpError } from "@atlas/core/http/errors";

export function pollNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Poll not found.",
  });
}

export function pollClosed(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Poll is closed.",
  });
}

export function pollOptionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Poll option not found.",
  });
}

export function enrollmentRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Active enrollment required to respond.",
  });
}
