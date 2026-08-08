import { AtlasHttpError } from "@atlas/core/http/errors";

export function enrollmentRosterEmptyAudience() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "No learners matched the current enrollment filters.",
  });
}

export function enrollmentRosterMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}
