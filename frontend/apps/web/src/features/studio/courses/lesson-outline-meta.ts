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
  lessonType?: string | null;
  videoUrl?: string | null;
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
  return `${lessonCount} ${lessonLabel} • ${quizCount} ${quizLabel}`;
}

export function resolveLessonBadges(lesson: LessonOutlineItem): LessonOutlineBadge[] {
  const badges: LessonOutlineBadge[] = [];

  if (lesson.lessonType === "live") {
    badges.push({
      key: "live",
      label: "Live",
      className:
        "bg-[color-mix(in_srgb,var(--admin-lesson-live)_14%,var(--admin-surface))] text-[var(--admin-lesson-live)]",
    });
  }

  if (lesson.status === "DRAFT") {
    badges.push({
      key: "unpublished",
      label: "Unpublished",
      className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    });
  } else if (lesson.status === "REVIEW") {
    badges.push({
      key: "review",
      label: "In review",
      className:
        "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
    });
  }

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
