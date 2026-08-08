import { AtlasHttpError } from "@atlas/core/http/errors";

export function customFieldRosterEmptyAudience() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message: "No learners matched the current filters.",
  });
}

export function customFieldRosterMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message,
  });
}

export function customFieldDetailNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Custom field not found.",
  });
}

export function customFieldLearnerNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Learner not found.",
  });
}

export function customFieldCohortCampaignNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Cohort message campaign not found.",
  });
}

export function customFieldCohortRetryFailed(message: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message,
  });
}
