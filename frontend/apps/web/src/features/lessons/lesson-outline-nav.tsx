"use client";

import Link from "next/link";
import {
  Circle,
  CircleCheck,
  CircleDot,
  ClipboardList,
  FileText,
  FileType,
  Headphones,
  ListChecks,
  Package,
  PlayCircle,
  Presentation,
  Radio,
  type LucideIcon,
} from "lucide-react";
import {
  formatLessonDuration,
  lessonStatusLabel,
  lessonTypeLabel,
  outlineProgressLabel,
  type LearnerCourseOutline,
  type OutlineLessonStatus,
} from "./course-outline-model";
import { LessonTrack } from "./lesson-track";

const TYPE_ICONS: Record<string, LucideIcon> = {
  article: FileText,
  video: PlayCircle,
  audio: Headphones,
  pdf: FileType,
  slides: Presentation,
  live: Radio,
  section_quiz: ListChecks,
  quiz: ListChecks,
  assignment: ClipboardList,
};

/** The icon for a lesson's type: play for video, a page for an article… */
export function lessonTypeIcon(lessonType: string | null): LucideIcon {
  return (lessonType ? TYPE_ICONS[lessonType] : undefined) ?? FileText;
}

export function LessonStatusIcon({
  status,
  className = "h-4 w-4",
}: {
  status: OutlineLessonStatus;
  className?: string;
}) {
  if (status === "completed") {
    return <CircleCheck className={`${className} text-success`} aria-hidden="true" />;
  }
  if (status === "in_progress") {
    return <CircleDot className={`${className} text-warning`} aria-hidden="true" />;
  }
  return <Circle className={`${className} text-muted-foreground/60`} aria-hidden="true" />;
}

type LessonOutlineNavProps = {
  outline: LearnerCourseOutline;
  courseId: string;
  courseTitle: string;
  currentLessonId: string;
  /** Called when a lesson link is followed, so the mobile drawer can close. */
  onNavigate?: () => void;
};

/** The course's chapters and lessons beside the lesson, with what's done. */
export function LessonOutlineNav({
  outline,
  courseId,
  courseTitle,
  currentLessonId,
  onNavigate,
}: LessonOutlineNavProps) {
  const handleNavigate = () => onNavigate?.();
  return (
    <nav aria-label="Course content" className="flex min-h-0 flex-col">
      <div className="space-y-3 border-b border-border pb-4">
        <Link
          href={`/courses/${courseId}`}
          onClick={handleNavigate}
          className="block text-sm font-semibold leading-snug text-foreground hover:underline"
        >
          {courseTitle}
        </Link>
        <LessonTrack outline={outline} currentLessonId={currentLessonId} />
        <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span>{outlineProgressLabel(outline)}</span>
          <span className="font-semibold tabular-nums text-foreground">{outline.progressPct}%</span>
        </p>
      </div>

      <ol className="min-h-0 flex-1 space-y-5 overflow-y-auto pt-4">
        {outline.modules.map((module) => (
          <li key={module.id}>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {module.title}
            </p>
            {module.contentKind === "scorm" ? (
              <Link
                href={`/courses/${courseId}/modules/${module.id}`}
                onClick={handleNavigate}
                className="mt-1.5 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Open interactive chapter
              </Link>
            ) : module.lessons.length === 0 ? (
              <p className="px-2 pt-1.5 text-sm text-muted-foreground">No lessons yet.</p>
            ) : (
              <ol className="mt-1.5 space-y-0.5">
                {module.lessons.map((lesson) => {
                  const current = lesson.id === currentLessonId;
                  const TypeIcon = lessonTypeIcon(lesson.lessonType);
                  const duration = formatLessonDuration(lesson.durationSeconds);
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/courses/${courseId}/lessons/${lesson.id}`}
                        onClick={handleNavigate}
                        aria-current={current ? "page" : undefined}
                        className={[
                          "group flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                          current
                            ? "bg-primary/10 font-medium text-foreground"
                            : "text-foreground/85 hover:bg-muted",
                        ].join(" ")}
                      >
                        <span className="mt-0.5 shrink-0">
                          <LessonStatusIcon status={lesson.status} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug">{lesson.title}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                            <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            {lessonTypeLabel(lesson.lessonType)}
                            {duration ? <span aria-hidden="true">·</span> : null}
                            {duration}
                          </span>
                        </span>
                        <span className="sr-only">, {lessonStatusLabel(lesson.status)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
