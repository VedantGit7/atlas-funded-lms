"use client";

import Link from "next/link";
import type { z } from "zod";
import type { learnerLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { LessonAssetList } from "./lesson-asset-list";
import { LessonCommentsPanel } from "./lesson-comments-panel";
import { LessonTranscriptPanel } from "./lesson-transcript-panel";
import { LessonAutosaveIndicator } from "./lesson-autosave-indicator";
import { LessonContentViewer } from "./lesson-content-viewer";
import { LessonNextAction } from "./lesson-next-action";
import { LessonProgressPanel } from "./lesson-progress-panel";
import { LessonProgressProvider } from "./lesson-progress-context";
import { MarkCompleteButton } from "./mark-complete-button";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;

type LessonPlayerShellProps = {
  courseTitle: string;
  lesson: LearnerLessonDetail;
};

export function LessonPlayerShell({ courseTitle, lesson }: LessonPlayerShellProps) {
  const features = lesson.features ?? {
    allowComments: true,
    enableDownloads: true,
    showTranscript: true,
  };

  return (
    <LessonProgressProvider lessonId={lesson.id} initialProgress={lesson.progress}>
      <main className="space-y-6 pb-28 md:pb-0">
        <header className="space-y-2 border-b pb-4">
          <p className="text-sm opacity-70">
            <Link href="/courses">Courses</Link>
            {" → "}
            <Link href={`/courses/${lesson.courseId}`}>{courseTitle}</Link>
            {" → "}
            {lesson.title}
          </p>
          <h1 className="text-2xl font-semibold md:text-3xl">{lesson.title}</h1>
          {lesson.thumbnailUrl ? (
            <img
              src={lesson.thumbnailUrl}
              alt=""
              className="max-h-56 w-full rounded-lg object-cover"
            />
          ) : null}
          {lesson.description ? <p className="opacity-80">{lesson.description}</p> : null}
          {lesson.tags && lesson.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {lesson.tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    href={`/courses/${lesson.courseId}?tagId=${encodeURIComponent(tag.id)}`}
                    className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                  >
                    {tag.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        <LessonContentViewer lesson={lesson} />
        {features.enableDownloads ? <LessonAssetList lessonId={lesson.id} /> : null}
        {features.showTranscript && lesson.transcriptText ? (
          <LessonTranscriptPanel transcriptText={lesson.transcriptText} />
        ) : null}
        {features.allowComments ? <LessonCommentsPanel lessonId={lesson.id} /> : null}
        <LessonProgressPanel />

        <div className="hidden flex-wrap items-center gap-3 md:flex">
          <MarkCompleteButton />
          <LessonNextAction
            courseId={lesson.courseId}
            previousLessonId={lesson.navigation.previousLessonId}
            nextLessonId={lesson.navigation.nextLessonId}
          />
          <LessonAutosaveIndicator />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <MarkCompleteButton compact />
          <LessonNextAction
            compact
            courseId={lesson.courseId}
            previousLessonId={lesson.navigation.previousLessonId}
            nextLessonId={lesson.navigation.nextLessonId}
          />
          <LessonAutosaveIndicator />
        </div>
      </div>
    </LessonProgressProvider>
  );
}
