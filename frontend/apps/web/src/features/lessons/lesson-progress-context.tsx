"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { captureProductEvent } from "../../observability/capture-product-event";

export type LessonProgressState = {
  status: "not_started" | "in_progress" | "completed";
  progressPct: number;
  positionSeconds: number | null;
  completedAt: string | null;
  lastSeenAt: string | null;
};

type AutosaveState = "idle" | "saving" | "saved" | "error";

type LessonProgressContextValue = {
  lessonId: string;
  progress: LessonProgressState;
  autosave: AutosaveState;
  markComplete: () => Promise<void>;
  updatePosition: (positionSeconds: number) => Promise<void>;
  completeBusy: boolean;
  completeError: string | null;
};

const LessonProgressContext = createContext<LessonProgressContextValue | null>(null);

function defaultProgress(): LessonProgressState {
  return {
    status: "not_started",
    progressPct: 0,
    positionSeconds: null,
    completedAt: null,
    lastSeenAt: null,
  };
}

type LessonProgressProviderProps = {
  lessonId: string;
  initialProgress: LessonProgressState | null | undefined;
  children: ReactNode;
};

export function LessonProgressProvider({
  lessonId,
  initialProgress,
  children,
}: LessonProgressProviderProps) {
  const [progress, setProgress] = useState<LessonProgressState>(
    initialProgress ?? defaultProgress(),
  );
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const updatePosition = useCallback(
    async (positionSeconds: number) => {
      if (progress.status === "completed") return;

      const previous = progress;
      const optimistic: LessonProgressState = {
        ...progress,
        status: progress.status === "not_started" ? "in_progress" : progress.status,
        positionSeconds,
        lastSeenAt: new Date().toISOString(),
      };
      setProgress(optimistic);
      setAutosave("saving");

      try {
        const response = await clientApi.post<{ data: LessonProgressState }>(
          `/api/v1/lessons/${lessonId}/progress`,
          { positionSeconds, completed: false },
          `lesson-progress-${lessonId}`,
        );
        setProgress(response.data);
        setAutosave("saved");
      } catch {
        setProgress(previous);
        setAutosave("error");
      }
    },
    [lessonId, progress],
  );

  const markComplete = useCallback(async () => {
    if (progress.status === "completed" || completeBusy) return;

    setCompleteBusy(true);
    setCompleteError(null);

    const optimistic: LessonProgressState = {
      ...progress,
      status: "completed",
      progressPct: 100,
      completedAt: new Date().toISOString(),
    };
    const previous = progress;
    setProgress(optimistic);
    setAutosave("saving");

    try {
      const response = await clientApi.post<{ data: LessonProgressState }>(
        `/api/v1/lessons/${lessonId}/progress`,
        { completed: true, positionSeconds: progress.positionSeconds ?? 0 },
        `lesson-complete-${lessonId}`,
      );
      setProgress(response.data);
      setAutosave("saved");
      captureProductEvent("lesson_completed", {
        routeGroup: "learner",
        source: "lesson_player",
        contentType: "lesson",
        outcome: "completed",
      });
    } catch (completeError) {
      setProgress(previous);
      setCompleteError(
        completeError instanceof ClientApiError
          ? completeError.message
          : "Failed to save progress.",
      );
      setAutosave("error");
    } finally {
      setCompleteBusy(false);
    }
  }, [completeBusy, lessonId, progress]);

  const value = useMemo(
    () => ({
      lessonId,
      progress,
      autosave,
      markComplete,
      updatePosition,
      completeBusy,
      completeError,
    }),
    [autosave, completeBusy, completeError, lessonId, markComplete, progress, updatePosition],
  );

  return <LessonProgressContext.Provider value={value}>{children}</LessonProgressContext.Provider>;
}

export function useLessonProgress(): LessonProgressContextValue {
  const context = useContext(LessonProgressContext);
  if (!context) {
    throw new Error("useLessonProgress must be used within LessonProgressProvider");
  }
  return context;
}
