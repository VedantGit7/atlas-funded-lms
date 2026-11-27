"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { clientApi } from "../../lib/client-api";
import {
  formatLessonDuration,
  lessonStatusLabel,
  type LearnerCourseOutline,
  type OutlineLessonStatus,
} from "../lessons/course-outline-model";
import { LessonStatusIcon } from "../lessons/lesson-outline-nav";

type CourseModuleOutlineItem = {
  id: string;
  title: string;
  position: number;
  lessonCount: number;
  contentKind: "standard" | "scorm";
  scormLaunchReady: boolean;
};

type LessonOutlineItem = {
  id: string;
  slug?: string;
  title: string;
  position: number;
  durationSeconds: number | null;
  /** Set when the lessons come from the learner's own outline. */
  status?: OutlineLessonStatus;
};

type CourseOutlineProps = {
  courseId: string;
  modules: CourseModuleOutlineItem[];
  enrolled: boolean;
  /** The learner's outline with progress; used instead of loading each chapter. */
  outline?: LearnerCourseOutline | null;
  tagId?: string;
};

export function courseModuleLessonsPath(moduleId: string, tagId?: string): string {
  const path = `/api/v1/modules/${moduleId}/lessons`;
  return tagId ? `${path}?tagId=${encodeURIComponent(tagId)}` : path;
}

export function CourseOutline({
  courseId,
  modules,
  enrolled,
  outline = null,
  tagId,
}: CourseOutlineProps) {
  const [fetchedLessons, setModuleLessons] = useState<Record<string, LessonOutlineItem[]>>({});
  const [loading, setLoading] = useState(false);
  // Without a tag filter the learner's outline already has every chapter's
  // lessons and what's done in each (QA review 2 H20).
  const fromOutline = outline && !tagId ? outline : null;
  const moduleLessons: Record<string, LessonOutlineItem[]> = fromOutline
    ? Object.fromEntries(fromOutline.modules.map((module) => [module.id, module.lessons]))
    : fetchedLessons;

  useEffect(() => {
    let cancelled = false;
    setModuleLessons({});

    if (!enrolled || fromOutline) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Enrolled learners can open lessons with or without a tag filter.
    void Promise.all(
      modules
        .filter((m) => m.contentKind === "standard")
        .map(async (module) => {
          try {
            const response = await clientApi.get<{ data: { items: LessonOutlineItem[] } }>(
              courseModuleLessonsPath(module.id, tagId),
            );
            return { moduleId: module.id, lessons: response.data.items };
          } catch {
            return { moduleId: module.id, lessons: [] };
          }
        }),
    )
      .then((results) => {
        if (cancelled) return;
        const lessonsMap: Record<string, LessonOutlineItem[]> = {};
        for (const result of results) {
          lessonsMap[result.moduleId] = result.lessons;
        }
        setModuleLessons(lessonsMap);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tagId, enrolled, modules, fromOutline]);

  const showLessons = enrolled;

  if (modules.length === 0) {
    return <p role="status">This course does not have a published module outline yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {modules.map((module) => {
        const isScorm = module.contentKind === "scorm";
        const lessons = moduleLessons[module.id] || [];
        const hasLessons = showLessons && !loading && lessons.length > 0;

        return (
          <li key={module.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide opacity-60">
                  Chapter {module.position}
                </p>
                <h3 className="font-medium">{module.title}</h3>
                {isScorm ? (
                  <p className="mt-1 text-sm opacity-70">
                    {module.scormLaunchReady ? "SCORM package" : "SCORM package pending"}
                  </p>
                ) : (
                  <p className="mt-1 text-sm opacity-70">
                    {showLessons && !loading
                      ? `${String(lessons.length)} ${tagId ? "matching " : ""}${lessons.length === 1 ? "lesson" : "lessons"}`
                      : `${String(module.lessonCount)} ${module.lessonCount === 1 ? "lesson" : "lessons"}`}
                  </p>
                )}
              </div>

              {isScorm ? (
                enrolled && module.scormLaunchReady ? (
                  <Link
                    href={`/courses/${courseId}/modules/${module.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <Package className="h-4 w-4" aria-hidden="true" />
                    Open chapter
                  </Link>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm opacity-50">
                    <Package className="h-4 w-4" aria-hidden="true" />
                    SCORM
                  </span>
                )
              ) : null}
            </div>

            {hasLessons ? (
              <ol className="mt-3 space-y-1 border-t pt-3">
                {lessons.map((lesson, index) => {
                  const duration = formatLessonDuration(lesson.durationSeconds);
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/courses/${courseId}/lessons/${lesson.id}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        {lesson.status ? (
                          <LessonStatusIcon status={lesson.status} />
                        ) : (
                          <span className="w-4 text-right text-muted-foreground">{index + 1}.</span>
                        )}
                        <span className="min-w-0 flex-1">{lesson.title}</span>
                        {duration ? (
                          <span className="shrink-0 text-xs text-muted-foreground">{duration}</span>
                        ) : null}
                        {lesson.status ? (
                          <span className="sr-only">, {lessonStatusLabel(lesson.status)}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : showLessons && !loading && !isScorm && lessons.length === 0 ? (
              <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
                {tagId
                  ? "No lessons match this tag in this chapter."
                  : "This chapter does not have any published lessons yet."}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
