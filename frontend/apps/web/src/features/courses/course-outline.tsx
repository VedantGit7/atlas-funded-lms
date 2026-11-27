"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock, Package } from "lucide-react";
import { clientApi } from "../../lib/client-api";
import {
  formatLessonDuration,
  lessonStatusLabel,
  lessonTypeLabel,
  type LearnerCourseOutline,
  type OutlineLessonStatus,
} from "../lessons/course-outline-model";
import { LessonStatusIcon, lessonTypeIcon } from "../lessons/lesson-outline-nav";

type CourseModuleOutlineItem = {
  id: string;
  title: string;
  position: number;
  lessonCount: number;
  contentKind: "standard" | "scorm";
  scormLaunchReady: boolean;
};

type OutlineRowLesson = {
  id: string;
  title: string;
  durationSeconds: number | null;
  lessonType?: string | null;
  /** Set once the learner is enrolled. */
  status?: OutlineLessonStatus;
};

type OutlineRowModule = {
  id: string;
  title: string;
  position: number;
  contentKind: "standard" | "scorm";
  scormLaunchReady: boolean;
  lessonCount: number;
  lessons: OutlineRowLesson[] | null;
};

type CourseOutlineProps = {
  courseId: string;
  /** The published chapters; used when the outline can't be loaded. */
  modules: CourseModuleOutlineItem[];
  enrolled: boolean;
  /** Every chapter and lesson, with the learner's progress once enrolled. */
  outline?: LearnerCourseOutline | null;
  tagId?: string;
};

export function courseModuleLessonsPath(moduleId: string, tagId?: string): string {
  const path = `/api/v1/modules/${moduleId}/lessons`;
  return tagId ? `${path}?tagId=${encodeURIComponent(tagId)}` : path;
}

/** Lessons matching a tag, loaded chapter by chapter (enrolled learners only). */
function useTaggedLessons(
  modules: CourseModuleOutlineItem[],
  tagId: string | undefined,
  enabled: boolean,
): Record<string, OutlineRowLesson[]> | null {
  const [lessons, setLessons] = useState<Record<string, OutlineRowLesson[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLessons(null);
    if (!enabled || !tagId) return;

    void Promise.all(
      modules
        .filter((module) => module.contentKind === "standard")
        .map(async (module) => {
          try {
            const response = await clientApi.get<{ data: { items: OutlineRowLesson[] } }>(
              courseModuleLessonsPath(module.id, tagId),
            );
            return [module.id, response.data.items] as const;
          } catch {
            return [module.id, [] as OutlineRowLesson[]] as const;
          }
        }),
    ).then((entries) => {
      if (!cancelled) setLessons(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [modules, tagId, enabled]);

  return lessons;
}

function rowsFor(
  props: CourseOutlineProps,
  tagged: Record<string, OutlineRowLesson[]> | null,
): OutlineRowModule[] {
  const byId = new Map(props.modules.map((module) => [module.id, module]));
  if (props.tagId && props.enrolled) {
    return props.modules.map((module) => ({
      ...module,
      lessons: tagged ? (tagged[module.id] ?? []) : null,
    }));
  }
  if (props.outline) {
    return props.outline.modules.map((module) => ({
      id: module.id,
      title: module.title,
      position: module.position,
      contentKind: module.contentKind,
      scormLaunchReady: byId.get(module.id)?.scormLaunchReady ?? false,
      lessonCount: module.lessons.length,
      lessons: module.lessons,
    }));
  }
  return props.modules.map((module) => ({ ...module, lessons: null }));
}

/**
 * The course's chapters and lessons. Before enrolling it shows what the course
 * covers, lesson by lesson (QA review 1 M38); once enrolled every lesson opens
 * and shows what's done (QA review 2 H20).
 */
export function CourseOutline(props: CourseOutlineProps) {
  const { courseId, enrolled, tagId } = props;
  const tagged = useTaggedLessons(props.modules, tagId, enrolled);
  const rows = rowsFor(props, tagged);
  const resumeLessonId = enrolled ? (props.outline?.resumeLessonId ?? null) : null;

  if (rows.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        The chapters will appear here once the first one is published.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((module, index) => {
        const isScorm = module.contentKind === "scorm";
        const lessons = module.lessons;
        const holdsResume = lessons?.some((lesson) => lesson.id === resumeLessonId) ?? false;
        const length = lessons
          ? formatLessonDuration(
              lessons.reduce((total, lesson) => total + (lesson.durationSeconds ?? 0), 0),
            )
          : null;
        const count = lessons ? lessons.length : module.lessonCount;
        const countLabel = isScorm
          ? module.scormLaunchReady
            ? "Interactive package"
            : "Interactive package, not ready yet"
          : `${String(count)} ${tagId && enrolled ? "matching " : ""}${count === 1 ? "lesson" : "lessons"}`;

        return (
          <li key={module.id}>
            <details className="group/chapter" open={index === 0 || holdsResume || Boolean(tagId)}>
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Chapter {module.position}
                  </span>
                  <span className="mt-0.5 block font-semibold text-foreground">{module.title}</span>
                </span>
                <span className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground">
                  {countLabel}
                  {length ? <span className="block">{length}</span> : null}
                </span>
                <ChevronDown
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/chapter:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>

              <div className="px-2 pb-3 sm:px-3">
                {isScorm ? (
                  enrolled && module.scormLaunchReady ? (
                    <Link
                      href={`/courses/${courseId}/modules/${module.id}`}
                      className="mx-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Package className="h-4 w-4" aria-hidden="true" />
                      Open chapter
                    </Link>
                  ) : (
                    <p className="px-2 text-sm text-muted-foreground">
                      {enrolled
                        ? "This chapter opens once its package is ready."
                        : "Enroll to open this chapter."}
                    </p>
                  )
                ) : lessons === null ? (
                  <p className="px-2 text-sm text-muted-foreground">
                    {enrolled && tagId ? "Loading lessons…" : "Lessons will be listed here."}
                  </p>
                ) : lessons.length === 0 ? (
                  <p className="px-2 text-sm text-muted-foreground">
                    {tagId
                      ? "No lessons match this tag in this chapter."
                      : "No lessons published in this chapter yet."}
                  </p>
                ) : (
                  <ol className="space-y-0.5">
                    {lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <OutlineLessonRow
                          courseId={courseId}
                          lesson={lesson}
                          enrolled={enrolled}
                          isNext={lesson.id === resumeLessonId}
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

function OutlineLessonRow({
  courseId,
  lesson,
  enrolled,
  isNext,
}: {
  courseId: string;
  lesson: OutlineRowLesson;
  enrolled: boolean;
  isNext: boolean;
}) {
  const duration = formatLessonDuration(lesson.durationSeconds);
  const TypeIcon = lessonTypeIcon(lesson.lessonType ?? null);
  const typeLabel = lesson.lessonType ? lessonTypeLabel(lesson.lessonType) : null;
  const meta = [typeLabel, duration].filter(Boolean).join(" · ");

  const body = (
    <>
      {enrolled && lesson.status ? (
        <LessonStatusIcon status={lesson.status} className="h-4 w-4 shrink-0" />
      ) : (
        <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-foreground">{lesson.title}</span>
        {meta ? <span className="block text-xs text-muted-foreground">{meta}</span> : null}
      </span>
      {isNext ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          Up next
        </span>
      ) : null}
      {enrolled && lesson.status ? (
        <span className="sr-only">, {lessonStatusLabel(lesson.status)}</span>
      ) : null}
      {!enrolled ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
      ) : null}
    </>
  );

  if (!enrolled) {
    return <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">{body}</div>;
  }
  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {body}
    </Link>
  );
}
