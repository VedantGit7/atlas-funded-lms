"use client";

import { useEffect, useRef } from "react";
import { useLessonProgress } from "./lesson-progress-context";

export function LessonProgressPanel() {
  const { lessonId, progress, updatePosition } = useLessonProgress();
  const savedVisitFor = useRef<string | null>(null);

  // Opening a lesson saves once: it marks the lesson in progress and updates
  // when it was last seen, which "continue learning" uses to pick the lesson to
  // resume. The saved position stays as it is, because the embedded player
  // doesn't report one yet. The panel used to save position + 30 s whenever the
  // position changed, and each save changed it, so an open lesson wrote a
  // made-up position every ~1.75 s for as long as it stayed open (launch plan
  // 5.1, staging, 6 November 2026).
  useEffect(() => {
    if (savedVisitFor.current === lessonId) return;
    savedVisitFor.current = lessonId;
    if (progress.status === "completed") return;
    void updatePosition(progress.positionSeconds ?? 0);
  }, [lessonId, progress.positionSeconds, progress.status, updatePosition]);

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
