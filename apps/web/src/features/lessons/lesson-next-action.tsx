"use client";

import Link from "next/link";

type LessonNextActionProps = {
  courseId: string;
  previousLessonId: string | null;
  nextLessonId: string | null;
};

export function LessonNextAction({
  courseId,
  previousLessonId,
  nextLessonId,
}: LessonNextActionProps) {
  return (
    <nav className="flex flex-wrap gap-3" aria-label="Lesson navigation">
      {previousLessonId ? (
        <Link href={`/courses/${courseId}/lessons/${previousLessonId}`}>Previous lesson</Link>
      ) : null}
      {nextLessonId ? (
        <Link href={`/courses/${courseId}/lessons/${nextLessonId}`}>Next lesson</Link>
      ) : null}
      <Link href={`/courses/${courseId}`}>Back to course</Link>
    </nav>
  );
}
