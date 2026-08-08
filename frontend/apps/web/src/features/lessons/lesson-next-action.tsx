"use client";

import Link from "next/link";

type LessonNextActionProps = {
  courseId: string;
  previousLessonId: string | null;
  nextLessonId: string | null;
  compact?: boolean;
};

export function LessonNextAction({
  courseId,
  previousLessonId,
  nextLessonId,
  compact = false,
}: LessonNextActionProps) {
  const linkClass = compact ? "rounded border px-3 py-2 text-sm text-center" : "underline";

  return (
    <nav
      className={compact ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-3"}
      aria-label="Lesson navigation"
    >
      {previousLessonId ? (
        <Link href={`/courses/${courseId}/lessons/${previousLessonId}`} className={linkClass}>
          Previous
        </Link>
      ) : null}
      {nextLessonId ? (
        <Link href={`/courses/${courseId}/lessons/${nextLessonId}`} className={linkClass}>
          Next
        </Link>
      ) : null}
      <Link
        href={`/courses/${courseId}`}
        className={compact ? "col-span-2 rounded border px-3 py-2 text-center text-sm" : linkClass}
      >
        Back to course
      </Link>
    </nav>
  );
}
