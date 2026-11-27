import type { LearnerCourseOutline } from "@atlas/contracts/courses/course-outline.schemas";

export type { LearnerCourseOutline };
export type OutlineModule = LearnerCourseOutline["modules"][number];
export type OutlineLesson = OutlineModule["lessons"][number];
export type OutlineLessonStatus = OutlineLesson["status"];

export function courseOutlinePath(courseId: string): string {
  return `/api/v1/courses/${courseId}/outline`;
}

/**
 * The outline with the open lesson's status as the player knows it now: marking
 * a lesson complete updates its tick and the course totals without a reload.
 */
export function withLessonStatus(
  outline: LearnerCourseOutline,
  lessonId: string,
  status: OutlineLessonStatus,
): LearnerCourseOutline {
  const before = outlineLessons(outline).find((lesson) => lesson.id === lessonId)?.status ?? null;
  const modules = outline.modules.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) =>
      lesson.id === lessonId ? { ...lesson, status } : lesson,
    ),
  }));
  if (before === null || before === status) return { ...outline, modules };

  const delta = (status === "completed" ? 1 : 0) - (before === "completed" ? 1 : 0);
  const completedLessons = Math.min(
    outline.totalLessons,
    Math.max(0, outline.completedLessons + delta),
  );
  return {
    ...outline,
    modules,
    completedLessons,
    progressPct:
      outline.totalLessons > 0 ? Math.round((completedLessons / outline.totalLessons) * 100) : 0,
  };
}

/** Every listed lesson, in course order. */
export function outlineLessons(outline: LearnerCourseOutline): OutlineLesson[] {
  return outline.modules.flatMap((module) => module.lessons);
}

export function findOutlineLesson(
  outline: LearnerCourseOutline | null,
  lessonId: string | null,
): OutlineLesson | null {
  if (!outline || !lessonId) return null;
  return outlineLessons(outline).find((lesson) => lesson.id === lessonId) ?? null;
}

export function findOutlineModuleOf(
  outline: LearnerCourseOutline | null,
  lessonId: string,
): OutlineModule | null {
  return outline?.modules.find((module) => module.lessons.some((l) => l.id === lessonId)) ?? null;
}

/** "6 min", "1 h 5 min"; null when the length isn't known. */
export function formatLessonDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${String(hours)} h ${String(rest)} min` : `${String(hours)} h`;
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  slides: "Slides",
  live: "Live class",
  section_quiz: "Quiz",
  quiz: "Quiz",
  assignment: "Assignment",
  scorm: "Interactive",
};

export function lessonTypeLabel(lessonType: string | null): string {
  return (lessonType && LESSON_TYPE_LABELS[lessonType]) ?? "Lesson";
}

export function lessonStatusLabel(status: OutlineLessonStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}

/** "3 of 12 lessons done". */
export function outlineProgressLabel(outline: LearnerCourseOutline): string {
  const noun = outline.totalLessons === 1 ? "lesson" : "lessons";
  return `${String(outline.completedLessons)} of ${String(outline.totalLessons)} ${noun} done`;
}
