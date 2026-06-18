"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../lib/client-api";

type ProgressState = {
  status: "not_started" | "in_progress" | "completed";
  progressPct: number;
  positionSeconds: number | null;
  completedAt: string | null;
  lastSeenAt: string | null;
};

type MarkCompleteButtonProps = {
  lessonId: string;
  initialProgress: ProgressState | null | undefined;
};

export function MarkCompleteButton({ lessonId, initialProgress }: MarkCompleteButtonProps) {
  const [progress, setProgress] = useState<ProgressState>(
    initialProgress ?? {
      status: "not_started",
      progressPct: 0,
      positionSeconds: null,
      completedAt: null,
      lastSeenAt: null,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    if (progress.status === "completed") return;
    setBusy(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: ProgressState }>(
        `/api/v1/lessons/${lessonId}/progress`,
        { completed: true, positionSeconds: progress.positionSeconds ?? 0 },
        `lesson-complete-${lessonId}`,
      );
      setProgress(response.data);
    } catch (completeError) {
      setError(completeError instanceof ClientApiError ? completeError.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {progress.status === "completed" ? (
        <p role="status">Lesson completed</p>
      ) : (
        <button type="button" disabled={busy} onClick={() => void markComplete()}>
          {busy ? "Saving…" : "Mark complete"}
        </button>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
