"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ListTree, X } from "lucide-react";
import type { z } from "zod";
import type { learnerLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { LessonAssetList } from "./lesson-asset-list";
import { LessonCommentsPanel } from "./lesson-comments-panel";
import { LessonTranscriptPanel } from "./lesson-transcript-panel";
import { LessonAutosaveIndicator } from "./lesson-autosave-indicator";
import { LessonContentViewer } from "./lesson-content-viewer";
import { LessonNextAction, type NeighbourLesson } from "./lesson-next-action";
import { LessonOutlineNav, LessonStatusIcon } from "./lesson-outline-nav";
import { LessonProgressPanel } from "./lesson-progress-panel";
import { LessonProgressProvider, useLessonProgress } from "./lesson-progress-context";
import { LessonUpNext } from "./lesson-up-next";
import { MarkCompleteButton } from "./mark-complete-button";
import {
  findOutlineLesson,
  findOutlineModuleOf,
  formatLessonDuration,
  lessonStatusLabel,
  lessonTypeLabel,
  outlineProgressLabel,
  withLessonStatus,
  type LearnerCourseOutline,
} from "./course-outline-model";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;

type LessonPlayerShellProps = {
  courseTitle: string;
  lesson: LearnerLessonDetail;
  /** The learner's outline of the course; null when it couldn't be loaded. */
  outline?: LearnerCourseOutline | null;
};

export function LessonPlayerShell({ courseTitle, lesson, outline = null }: LessonPlayerShellProps) {
  return (
    <LessonProgressProvider lessonId={lesson.id} initialProgress={lesson.progress}>
      <LessonPlayerLayout courseTitle={courseTitle} lesson={lesson} outline={outline} />
    </LessonProgressProvider>
  );
}

function neighbour(
  outline: LearnerCourseOutline | null,
  lessonId: string | null,
): NeighbourLesson | null {
  if (!lessonId) return null;
  return { id: lessonId, title: findOutlineLesson(outline, lessonId)?.title ?? null };
}

function LessonPlayerLayout({
  courseTitle,
  lesson,
  outline,
}: Required<Pick<LessonPlayerShellProps, "courseTitle" | "lesson">> & {
  outline: LearnerCourseOutline | null;
}) {
  const { progress } = useLessonProgress();
  const drawerRef = useRef<HTMLDialogElement>(null);
  // "Up next" appears only when the lesson is completed while it's open, not
  // when the learner comes back to a lesson they finished earlier.
  const [openedCompleted] = useState(() => lesson.progress?.status === "completed");

  const completedByQuiz = lesson.content?.kind === "quiz" && Boolean(lesson.content.assessmentId);
  const features = lesson.features ?? {
    allowComments: true,
    enableDownloads: true,
    showTranscript: true,
  };

  const liveOutline = outline ? withLessonStatus(outline, lesson.id, progress.status) : null;
  const chapter = findOutlineModuleOf(liveOutline, lesson.id);
  const previous = neighbour(liveOutline, lesson.navigation.previousLessonId);
  const next = neighbour(liveOutline, lesson.navigation.nextLessonId);
  const courseComplete = liveOutline
    ? liveOutline.totalLessons > 0 && liveOutline.completedLessons >= liveOutline.totalLessons
    : false;
  const showUpNext = progress.status === "completed" && !openedCompleted;
  const duration = formatLessonDuration(lesson.durationSeconds ?? null);

  const closeDrawer = () => drawerRef.current?.close();

  return (
    <>
      <LessonProgressPanel />
      <div className="xl:grid xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-10">
        {liveOutline ? (
          <aside className="hidden xl:block">
            <div className="sticky top-24 flex max-h-[calc(100dvh-7.5rem)] flex-col rounded-2xl border border-border bg-card p-4">
              <LessonOutlineNav
                outline={liveOutline}
                courseId={lesson.courseId}
                courseTitle={courseTitle}
                currentLessonId={lesson.id}
              />
            </div>
          </aside>
        ) : null}

        <article className="mx-auto w-full max-w-3xl space-y-6 pb-32 md:pb-0">
          <header className="space-y-3 border-b border-border pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm text-muted-foreground">
                <Link
                  href={`/courses/${lesson.courseId}`}
                  className="hover:text-foreground hover:underline"
                >
                  {courseTitle}
                </Link>
                {chapter ? (
                  <>
                    <span aria-hidden="true"> / </span>
                    <span>{chapter.title}</span>
                  </>
                ) : null}
              </p>
              {liveOutline ? (
                <button
                  type="button"
                  onClick={() => drawerRef.current?.showModal()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 xl:hidden"
                >
                  <ListTree className="h-4 w-4" aria-hidden="true" />
                  Course content
                  <span className="text-xs font-normal text-muted-foreground">
                    {liveOutline.progressPct}%
                  </span>
                </button>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
              {lesson.title}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <LessonStatusIcon status={progress.status} />
                {lessonStatusLabel(progress.status)}
              </span>
              <span>{lessonTypeLabel(lesson.lessonType ?? null)}</span>
              {duration ? <span>{duration}</span> : null}
            </p>
            {lesson.thumbnailUrl ? (
              <img
                src={lesson.thumbnailUrl}
                alt=""
                className="max-h-56 w-full rounded-xl object-cover"
              />
            ) : null}
            {lesson.description ? (
              <p className="text-muted-foreground">{lesson.description}</p>
            ) : null}
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

          {showUpNext ? (
            <LessonUpNext courseId={lesson.courseId} next={next} courseComplete={courseComplete} />
          ) : null}

          <div className="hidden space-y-3 border-t border-border pt-5 md:block">
            <div className="flex flex-wrap items-center gap-3">
              <MarkCompleteButton completedByQuiz={completedByQuiz} />
              <LessonAutosaveIndicator />
            </div>
            <LessonNextAction courseId={lesson.courseId} previous={previous} next={next} />
          </div>

          {features.enableDownloads ? <LessonAssetList lessonId={lesson.id} /> : null}
          {features.showTranscript && lesson.transcriptText ? (
            <LessonTranscriptPanel transcriptText={lesson.transcriptText} />
          ) : null}
          {features.allowComments ? <LessonCommentsPanel lessonId={lesson.id} /> : null}
        </article>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {showUpNext ? null : <MarkCompleteButton compact completedByQuiz={completedByQuiz} />}
          <LessonNextAction compact courseId={lesson.courseId} previous={previous} next={next} />
          <LessonAutosaveIndicator />
        </div>
      </div>

      {liveOutline ? (
        <dialog
          ref={drawerRef}
          aria-label="Course content"
          onClick={(event) => {
            // A click on the backdrop (the dialog itself, outside its panel) closes it.
            if (event.target === event.currentTarget) closeDrawer();
          }}
          className="m-0 ml-auto h-dvh max-h-dvh w-[22rem] max-w-[88vw] border-l border-border bg-card p-0 text-foreground backdrop:bg-black/50"
        >
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Course content</p>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close course content"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="sr-only">{outlineProgressLabel(liveOutline)}</p>
            <LessonOutlineNav
              outline={liveOutline}
              courseId={lesson.courseId}
              courseTitle={courseTitle}
              currentLessonId={lesson.id}
              onNavigate={closeDrawer}
            />
          </div>
        </dialog>
      ) : null}
    </>
  );
}
