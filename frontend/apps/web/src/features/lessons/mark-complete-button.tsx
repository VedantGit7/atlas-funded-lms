"use client";

import { Check, CircleCheck } from "lucide-react";
import { useLessonProgress } from "./lesson-progress-context";

type MarkCompleteButtonProps = {
  compact?: boolean;
  /**
   * A quiz lesson is completed by passing its quiz, so there is no button
   * (QA review 1 C6: "Mark complete" let learners skip the quiz).
   */
  completedByQuiz?: boolean;
};

export function MarkCompleteButton({
  compact = false,
  completedByQuiz = false,
}: MarkCompleteButtonProps) {
  const { progress, markComplete, completeBusy, completeError } = useLessonProgress();

  if (progress.status === "completed") {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-2 text-sm font-medium text-success-text"
      >
        <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />
        Lesson completed
      </p>
    );
  }

  if (completedByQuiz) {
    return <p className="text-sm text-muted-foreground">Pass the quiz to complete this lesson.</p>;
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        className={[
          "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60",
          compact ? "w-full" : "",
        ].join(" ")}
        disabled={completeBusy}
        onClick={() => void markComplete()}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        {completeBusy ? "Saving…" : "Mark complete"}
      </button>
      {completeError ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {completeError}
        </p>
      ) : null}
    </div>
  );
}
