import { AtlasHttpError } from "@atlas/core/http/errors";

export function superLiveCompareNotFound(message = "One or more compare targets were not found.") {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message,
  });
}

export function superLiveCompareTooFew() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Pick at least two items to compare.",
  });
}
