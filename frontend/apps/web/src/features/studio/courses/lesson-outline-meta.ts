import type { z } from "zod";
import type { publishStatusStudioSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonOutlineItemSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { LESSON_TYPE_OPTIONS, type LessonTypeOption } from "./lesson-type-options";

type LessonOutlineItem = z.infer<typeof studioLessonOutlineItemSchema>;
type PublishStatus = z.infer<typeof publishStatusStudioSchema>;

export type LessonOutlineBadge = {
  key: string;
  label: string;
  className: string;
};

export function resolveLessonTypeOption(
  lessonType: string | null | undefined,
): LessonTypeOption | null {
  if (!lessonType) return null;
  const normalized =
    lessonType === "text" ? "article" : lessonType === "mixed" ? "article" : lessonType;
  return LESSON_TYPE_OPTIONS.find((option) => option.id === normalized) ?? null;
}

export function resolveLessonDisplayType(lesson: {
  lessonType?: string | null | undefined;
  videoUrl?: string | null | undefined;
}): string | null {
  if (lesson.lessonType) {
    return lesson.lessonType === "text" ? "article" : lesson.lessonType;
  }
  if (lesson.videoUrl?.trim()) return "video";
  return null;
}

export function countSectionLessons(lessons: LessonOutlineItem[]): {
  lessonCount: number;
  quizCount: number;
} {
  let lessonCount = 0;
  let quizCount = 0;

  for (const lesson of lessons) {
    if (lesson.lessonType === "section_quiz") {
      quizCount += 1;
    } else {
      lessonCount += 1;
    }
  }

  return { lessonCount, quizCount };
}

export function formatSectionSummary(lessons: LessonOutlineItem[]): string {
  const { lessonCount, quizCount } = countSectionLessons(lessons);
  const lessonLabel = lessonCount === 1 ? "Lesson" : "Lessons";
  const quizLabel = quizCount === 1 ? "Quiz" : "Quizzes";
  return `${String(lessonCount)} ${lessonLabel} • ${String(quizCount)} ${quizLabel}`;
}

/** Shown on a section or lesson hidden from learners (stored as ARCHIVED). */
export const hiddenContentBadge: LessonOutlineBadge = {
  key: "hidden",
  label: "Hidden",
  className:
    "border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]",
};

/**
 * Shown on a section or lesson added to a live course and not published yet.
 * In a draft course everything is unpublished until approval, so nothing is
 * badged there but hidden content (QA review 2 H10: an "Unpublished" badge in
 * a draft course looked like a hide switch, and approval published it).
 */
export const draftContentBadge: LessonOutlineBadge = {
  key: "draft",
  label: "Draft",
  className:
    "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
};

/** The visibility badge for a section or lesson, if any. */
export function contentStatusBadge(
  status: PublishStatus,
  courseStatus: PublishStatus,
): LessonOutlineBadge | null {
  if (status === "ARCHIVED") return hiddenContentBadge;
  if (courseStatus === "PUBLISHED" && (status === "DRAFT" || status === "REVIEW")) {
    return draftContentBadge;
  }
  return null;
}

export function resolveLessonBadges(
  lesson: LessonOutlineItem,
  courseStatus: PublishStatus,
): LessonOutlineBadge[] {
  const badges: LessonOutlineBadge[] = [];

  if (lesson.lessonType === "live") {
    badges.push({
      key: "live",
      label: "Live",
      className:
        "bg-[color-mix(in_srgb,var(--admin-lesson-live)_14%,var(--admin-surface))] text-[var(--admin-lesson-live)]",
    });
  }

  const status = contentStatusBadge(lesson.status, courseStatus);
  if (status) badges.push(status);

  return badges;
}

export function studioLessonUrl(courseId: string, lessonId: string): string {
  if (typeof window === "undefined") {
    return `/studio/courses/${courseId}/lessons/${lessonId}`;
  }
  return `${window.location.origin}/studio/courses/${courseId}/lessons/${lessonId}`;
}

export function isQuizLesson(lesson: LessonOutlineItem): boolean {
  return lesson.lessonType === "section_quiz";
}

export function publishStatusLabel(status: PublishStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "REVIEW":
      return "In review";
    case "PUBLISHED":
      return "Published";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}
