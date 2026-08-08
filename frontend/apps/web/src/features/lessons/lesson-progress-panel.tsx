"use client";

import { useEffect } from "react";
import { useLessonProgress } from "./lesson-progress-context";

export function LessonProgressPanel() {
  const { progress, updatePosition } = useLessonProgress();

  useEffect(() => {
    if (progress.status === "completed") return;

    const positionSeconds = progress.positionSeconds ?? 0;
    const timer = window.setTimeout(() => {
      void updatePosition(positionSeconds + 30);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [progress.positionSeconds, progress.status, updatePosition]);

  return (
    <section className="rounded border p-4 text-sm">
      <h2 className="font-medium">Progress</h2>
      <p>
        Status: {progress.status} · {progress.progressPct}% complete
      </p>
      {progress.positionSeconds != null ? <p>Resume at {progress.positionSeconds}s</p> : null}
    </section>
  );
}
