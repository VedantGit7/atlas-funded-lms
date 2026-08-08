"use client";

import { useLessonProgress } from "./lesson-progress-context";

type MarkCompleteButtonProps = {
  compact?: boolean;
};

export function MarkCompleteButton({ compact = false }: MarkCompleteButtonProps) {
  const { progress, markComplete, completeBusy, completeError } = useLessonProgress();

  if (progress.status === "completed") {
    return (
      <p role="status" className={compact ? "text-sm" : undefined}>
        Lesson completed
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
