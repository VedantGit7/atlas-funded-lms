"use client";

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
      <p role="status" className={compact ? "text-sm" : undefined}>
        Lesson completed
      </p>
    );
  }

  if (completedByQuiz) {
    return (
      <p className={compact ? "text-sm text-muted-foreground" : "text-muted-foreground"}>
        Pass the quiz to complete this lesson.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        className={compact ? "w-full rounded border px-3 py-2 text-sm font-medium" : undefined}
        disabled={completeBusy}
        onClick={() => void markComplete()}
      >
        {completeBusy ? "Saving…" : "Mark complete"}
      </button>
      {completeError ? <p role="alert">{completeError}</p> : null}
    </div>
  );
}
