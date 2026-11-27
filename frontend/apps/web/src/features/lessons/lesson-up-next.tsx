"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck } from "lucide-react";

/** Seconds before the next lesson opens on its own. */
export const AUTO_ADVANCE_SECONDS = 6;

type LessonUpNextProps = {
  courseId: string;
  next: { id: string; title: string | null } | null;
  /** The whole course is done, so there's nowhere further to go. */
  courseComplete: boolean;
};

/**
 * Shown once the learner completes the open lesson (QA review 1 m41,
 * reviewer 6.4 "auto-advance"): the next lesson opens after a short countdown
 * unless they choose to stay. On the last lesson it says the course is done.
 */
export function LessonUpNext({ courseId, next, courseComplete }: LessonUpNextProps) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ADVANCE_SECONDS);
  const [stayed, setStayed] = useState(false);
  const nextHref = next ? `/courses/${courseId}/lessons/${next.id}` : null;

  useEffect(() => {
    if (!nextHref || stayed) return;
    if (secondsLeft <= 0) {
      router.push(nextHref);
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [nextHref, router, secondsLeft, stayed]);

  if (!next) {
    return (
      <section
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-4"
      >
        <CircleCheck className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {courseComplete ? "You've finished the course" : "Lesson complete"}
          </p>
          <p className="text-sm text-muted-foreground">
            {courseComplete
              ? "Every lesson is done."
              : "This was the last lesson. Some earlier lessons aren't finished yet."}
          </p>
        </div>
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Back to course
        </Link>
      </section>
    );
  }

  const counting = !stayed && secondsLeft > 0;

  return (
    <section
      aria-label="Up next"
      className="relative overflow-hidden rounded-2xl border border-border bg-muted/50 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <CircleCheck className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Lesson complete · Up next</p>
          <p className="truncate font-semibold text-foreground">{next.title ?? "Next lesson"}</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {counting
              ? `Opening in ${String(secondsLeft)} ${secondsLeft === 1 ? "second" : "seconds"}`
              : "Open it when you're ready."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {counting ? (
            <button
              type="button"
              onClick={() => {
                setStayed(true);
              }}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Stay on this lesson
            </button>
          ) : null}
          <Link
            href={nextHref ?? `/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Open next lesson
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      {counting ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary motion-safe:animate-[lesson-up-next_var(--up-next-duration)_linear_forwards] motion-reduce:hidden"
          style={{ ["--up-next-duration" as string]: `${String(AUTO_ADVANCE_SECONDS)}s` }}
        />
      ) : null}
    </section>
  );
}
