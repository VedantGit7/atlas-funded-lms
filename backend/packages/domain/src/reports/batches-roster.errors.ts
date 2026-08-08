import { AtlasHttpError } from "@atlas/core/http/errors";

export function batchRosterNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Batch not found.",
  });
}

export function batchRosterLearnerNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Learner is not a member of this batch.",
  });
}

export function batchRosterEmptyAudience() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "No learners matched the current filters.",
  });
}

export function batchRosterMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function batchLiveSessionNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live session not found for this batch.",
  });
}
