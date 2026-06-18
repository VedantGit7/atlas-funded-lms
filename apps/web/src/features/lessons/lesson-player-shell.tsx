"use client";

import Link from "next/link";
import type { z } from "zod";
import type { learnerLessonDetailSchema } from "../../server/lessons/lesson-schemas";
import { LessonAssetList } from "./lesson-asset-list";
import { LessonContentViewer } from "./lesson-content-viewer";
import { LessonNextAction } from "./lesson-next-action";
import { LessonProgressPanel } from "./lesson-progress-panel";
import { MarkCompleteButton } from "./mark-complete-button";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;

type LessonPlayerShellProps = {
  courseTitle: string;
  lesson: LearnerLessonDetail;
};

export function LessonPlayerShell({ courseTitle, lesson }: LessonPlayerShellProps) {
  return (
    <main className="space-y-6">
      <header className="space-y-2 border-b pb-4">
        <p className="text-sm opacity-70">
          <Link href="/courses">Courses</Link>
          {" → "}
          <Link href={`/courses/${lesson.courseId}`}>{courseTitle}</Link>
          {" → "}
          {lesson.title}
        </p>
        <h1 className="text-3xl font-semibold">{lesson.title}</h1>
        {lesson.description ? <p className="opacity-80">{lesson.description}</p> : null}
      </header>

      <LessonContentViewer lesson={lesson} />
      <LessonAssetList lessonId={lesson.id} />
      <LessonProgressPanel lesson={lesson} />
      <div className="flex flex-wrap items-center gap-3">
        <MarkCompleteButton lessonId={lesson.id} initialProgress={lesson.progress} />
        <LessonNextAction
          courseId={lesson.courseId}
          previousLessonId={lesson.navigation.previousLessonId}
          nextLessonId={lesson.navigation.nextLessonId}
        />
      </div>
    </main>
  );
}
