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

  // The lesson's status shows in the course outline beside the lesson, so
  // nothing is drawn here: this used to print the raw "in_progress" value and
  // a position no player reports (QA review 1 m41).
  return null;
}
