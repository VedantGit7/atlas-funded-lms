// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { AtlasHttpError } from "@atlas/core/http/errors";

export type CourseLifecycleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export function assertCourseEditable(status: CourseLifecycleStatus): void {
  if (status !== "DRAFT") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Course cannot be edited in its current state.",
    });
  }
}

export function assertCoursePublishable(status: CourseLifecycleStatus): void {
  if (status !== "DRAFT") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Only draft courses can be submitted for review.",
    });
  }
}

export function assertCourseInReviewForApproval(status: CourseLifecycleStatus): void {
  if (status !== "REVIEW") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Course is not in review state.",
    });
  }
}

export function assertCourseReviewableForAction(
  currentStatus: CourseLifecycleStatus,
  nextStatus: CourseLifecycleStatus,
): void {
  if (currentStatus !== "REVIEW") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Course is not in review state.",
    });
  }

  if (nextStatus !== "PUBLISHED" && nextStatus !== "DRAFT") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Invalid workflow transition for course review.",
    });
  }
}

export function canSubmitCourseForReview(status: CourseLifecycleStatus): boolean {
  return status === "DRAFT";
}

export function canApproveCourseReview(status: CourseLifecycleStatus): boolean {
  return status === "REVIEW";
}

export function assertCourseArchivable(
  status: CourseLifecycleStatus,
  hasActiveEnrollments: boolean,
): void {
  if (status === "PUBLISHED" && hasActiveEnrollments) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Published courses with active enrollments cannot be archived.",
    });
  }
}

export function assertModuleEditable(courseStatus: CourseLifecycleStatus): void {
  assertCourseEditable(courseStatus);
}

export function assertLessonEditable(courseStatus: CourseLifecycleStatus): void {
  assertCourseEditable(courseStatus);
}

export function validateLessonPositions(positions: number[]): void {
  if (positions.length === 0) {
    return;
  }

  const sorted = [...positions].sort((a, b) => a - b);
  const unique = new Set(sorted);

  if (unique.size !== sorted.length) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Lesson positions must be unique.",
    });
  }

  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index + 1) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Lesson positions must be sequential starting at 1.",
      });
    }
  }
}

export function validateModulePositions(positions: number[]): void {
  if (positions.length === 0) {
    return;
  }

  const sorted = [...positions].sort((a, b) => a - b);
  const unique = new Set(sorted);

  if (unique.size !== sorted.length) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Module positions must be unique.",
    });
  }

  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index + 1) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Module positions must be sequential starting at 1.",
      });
    }
  }
}
