"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { clientApi } from "../../lib/client-api";
import type { learnerLessonDetailSchema } from "../../server/lessons/lesson-schemas";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;
type ProgressState = NonNullable<LearnerLessonDetail["progress"]>;

type LessonProgressPanelProps = {
  lesson: LearnerLessonDetail;
};

export function LessonProgressPanel({ lesson }: LessonProgressPanelProps) {
  const [progress, setProgress] = useState<ProgressState>(
    lesson.progress ?? {
      status: "not_started",
      progressPct: 0,
      positionSeconds: null,
      completedAt: null,
      lastSeenAt: null,
    },
  );

  useEffect(() => {
    if (progress.status === "completed") return;

    const positionSeconds = progress.positionSeconds ?? 0;
    const timer = window.setTimeout(() => {
      void clientApi
        .post<{ data: ProgressState }>(
          `/api/v1/lessons/${lesson.id}/progress`,
          { positionSeconds: positionSeconds + 30, completed: false },
          `lesson-progress-${lesson.id}`,
        )
        .then((response) => {
          setProgress(response.data);
        })
        .catch(() => {
          /* ignore resume write failures in UI */
        });
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lesson.id, progress.positionSeconds, progress.status]);

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
