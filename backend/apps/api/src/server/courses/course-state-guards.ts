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

/**
 * Sections and lessons can be added, edited, moved and trashed while the
 * course is a draft or live (QA review 1 C27, review 2 C2 and C3). In a live
 * course, new ones start as drafts that learners can't see until they're
 * published one by one; edits to published lessons reach learners on save.
 * Only review (the reviewer is looking at a fixed course) and archive lock it.
 */
export function canEditCourseContent(status: CourseLifecycleStatus): boolean {
  return status === "DRAFT" || status === "PUBLISHED";
}

export function assertCourseContentEditable(status: CourseLifecycleStatus): void {
  if (status === "REVIEW") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "This course is in review. You can edit its content after the review.",
    });
  }
  if (!canEditCourseContent(status)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "This course is archived. Restore it to edit its content.",
    });
  }
}

export function assertModuleEditable(courseStatus: CourseLifecycleStatus): void {
  assertCourseContentEditable(courseStatus);
}

export function assertLessonEditable(courseStatus: CourseLifecycleStatus): void {
  assertCourseContentEditable(courseStatus);
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
