"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type NeighbourLesson = { id: string; title: string | null };

type LessonNextActionProps = {
  courseId: string;
  previous: NeighbourLesson | null;
  next: NeighbourLesson | null;
  compact?: boolean;
};

const baseButton =
  "flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/**
 * Previous and next lesson as real buttons, each naming the lesson it opens
 * (QA review 1 m41: navigation was two plain links).
 */
export function LessonNextAction({
  courseId,
  previous,
  next,
  compact = false,
}: LessonNextActionProps) {
  const href = (id: string) => `/courses/${courseId}/lessons/${id}`;

  return (
    <nav aria-label="Lesson navigation" className="grid grid-cols-2 gap-2">
      {previous ? (
        <Link
          href={href(previous.id)}
          className={`${baseButton} ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}
          aria-label={`Previous lesson${previous.title ? `: ${previous.title}` : ""}`}
        >
          <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Previous lesson</span>
            {!compact && previous.title ? (
              <span className="block truncate font-medium text-foreground">{previous.title}</span>
            ) : null}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link
          href={href(next.id)}
          className={`${baseButton} justify-end text-right ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}
          aria-label={`Next lesson${next.title ? `: ${next.title}` : ""}`}
        >
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Next lesson</span>
            {!compact && next.title ? (
              <span className="block truncate font-medium text-foreground">{next.title}</span>
            ) : null}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : (
        <Link
          href={`/courses/${courseId}`}
          className={`${baseButton} justify-end text-right ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}
        >
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Last lesson</span>
            {!compact ? (
              <span className="block truncate font-medium text-foreground">Back to course</span>
            ) : null}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
