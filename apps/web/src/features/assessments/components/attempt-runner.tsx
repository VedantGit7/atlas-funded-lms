"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { attemptRunnerResponseSchema } from "../assessment-response-schemas";

type AttemptRunner = z.infer<typeof attemptRunnerResponseSchema>["data"];
type RunnerItem = AttemptRunner["items"][number];

type AttemptRunnerProps = {
  initialAttempt: AttemptRunner;
};

function formatRemaining(serverNow: string, dueAt: string | null): string | null {
  if (!dueAt) return null;
  const remainingMs = new Date(dueAt).getTime() - new Date(serverNow).getTime();
  if (remainingMs <= 0) return "00:00";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AttemptRunner({ initialAttempt }: AttemptRunnerProps) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(
    new Date(initialAttempt.serverNow).getTime() - Date.now(),
  );

  const activeItem: RunnerItem | undefined = attempt.items[activeIndex];

  const timerLabel = useMemo(() => {
    const now = new Date(Date.now() + serverOffsetMs).toISOString();
    return formatRemaining(now, attempt.dueAt);
  }, [attempt.dueAt, serverOffsetMs, autosaveState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setServerOffsetMs(new Date(attempt.serverNow).getTime() - Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [attempt.serverNow]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && attempt.l1ProctoringEnabled) {
        setError("Focus warning: tab blur detected.");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [attempt.l1ProctoringEnabled]);

  async function saveAnswer(item: RunnerItem, answerJson: Record<string, unknown>) {
    setAutosaveState("saving");
    try {
      await clientApi.post(
        `/api/v1/attempts/${attempt.id}/answers`,
        { itemId: item.itemId, answerJson },
        `attempt-answer-${item.assessmentItemId}`,
      );
      setAttempt((current) => ({
        ...current,
        items: current.items.map((entry) =>
          entry.assessmentItemId === item.assessmentItemId
            ? { ...entry, savedAnswer: answerJson }
            : entry,
        ),
      }));
      setAutosaveState("saved");
    } catch {
      setAutosaveState("error");
    }
  }

  async function handleSubmit() {
    if (!window.confirm("Submit attempt? You cannot change answers after submission.")) return;
    setSubmitting(true);
    setError(null);
    try {
      await clientApi.post(`/api/v1/attempts/${attempt.id}/submit`, {}, "attempt-submit");
      router.push(`/attempts/${attempt.id}/result`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderItemInput(item: RunnerItem) {
    if (item.itemTypeKey === "true_false") {
      return (
        <div className="flex gap-3">
          {["true", "false"].map((value) => (
            <button
              key={value}
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => {
                void saveAnswer(item, { value: value === "true" });
              }}
            >
              {value}
            </button>
          ))}
        </div>
      );
    }

    if (item.options.length > 0) {
      return (
        <div className="space-y-2">
          {item.options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 rounded border p-3">
              <input
                type="radio"
                name={item.assessmentItemId}
                onChange={() => {
                  void saveAnswer(item, { selectedOptionId: option.id });
                }}
              />
              <span>{(option.optionJson as { label?: string }).label ?? option.id}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <textarea
        className="min-h-28 w-full rounded border p-3"
        defaultValue={JSON.stringify(item.savedAnswer ?? {})}
        onBlur={(event) => {
          try {
            const parsed = JSON.parse(event.target.value) as Record<string, unknown>;
            void saveAnswer(item, parsed);
          } catch {
            void saveAnswer(item, { value: event.target.value });
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">Attempt in progress</p>
          <h1 className="text-2xl font-semibold">Assessment attempt</h1>
        </div>
        <div className="text-right text-sm">
          {timerLabel ? <p>Time remaining: {timerLabel}</p> : null}
          <p>
            Autosave:{" "}
            {autosaveState === "saving"
              ? "Saving..."
              : autosaveState === "saved"
                ? "Saved"
                : autosaveState === "error"
                  ? "Error"
                  : "Idle"}
          </p>
        </div>
      </header>

      {attempt.secureMode ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Secure mode is active. Copy/paste and navigation may be restricted.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <section className="rounded border p-4">
          {activeItem ? (
            <>
              <p className="text-sm text-gray-600">
                Question {activeIndex + 1} of {attempt.items.length}
              </p>
              <h2 className="mt-2 text-lg font-medium">
                {(activeItem.contentJson as { stem?: string }).stem ?? "Question"}
              </h2>
              <div className="mt-4">{renderItemInput(activeItem)}</div>
            </>
          ) : (
            <p>No questions available.</p>
          )}
        </section>

        <nav className="rounded border p-4">
          <h2 className="font-medium">Navigator</h2>
          <ol className="mt-3 grid grid-cols-4 gap-2">
            {attempt.items.map((item, index) => (
              <li key={item.assessmentItemId}>
                <button
                  type="button"
                  className={`w-full rounded border px-2 py-2 text-sm ${
                    index === activeIndex ? "bg-gray-100" : ""
                  }`}
                  onClick={() => {
                    setActiveIndex(index);
                  }}
                >
                  {index + 1}
                  {item.savedAnswer ? "*" : ""}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded border px-4 py-2"
          disabled={submitting}
          onClick={() => {
            void handleSubmit();
          }}
        >
          {submitting ? "Submitting..." : "Submit attempt"}
        </button>
        <Link href={`/assessments/${attempt.assessmentId}`} className="rounded border px-4 py-2">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
