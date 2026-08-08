import { AtlasHttpError } from "@atlas/core/http/errors";

export function progressScoreCourseNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course not found.",
  });
}

export function progressScoreProductNotFound(productType: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: `${productType.replace(/_/g, " ")} not found.`,
  });
}

export function progressScoreAssessmentNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Quiz not found.",
  });
}

export function progressScoreEmptyAudience() {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "No learners matched the current filters.",
  });
}

export function progressScoreMessageFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function progressScoreEnrollmentNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Enrolment not found for this product.",
  });
}

export function progressScoreAttemptNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Attempt not found for this assessment.",
  });
}

export function progressScoreAttemptActionFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function progressScoreResetFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function progressScoreCohortCampaignNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Cohort message campaign not found.",
  });
}

export function progressScoreCohortRetryFailed(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}
