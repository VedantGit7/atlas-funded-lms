"use client";

import { useLessonProgress } from "./lesson-progress-context";

export function LessonAutosaveIndicator() {
  const { autosave } = useLessonProgress();

  if (autosave === "idle") return null;

  const label =
    autosave === "saving"
      ? "Saving progress…"
      : autosave === "saved"
        ? "Progress saved"
        : "Could not save progress";

  return (
    <p className="text-xs opacity-70" role="status" aria-live="polite">
      {label}
    </p>
  );
}
