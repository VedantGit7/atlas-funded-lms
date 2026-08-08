"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { captureProductEvent } from "../../../observability/capture-product-event";
import type { attemptRunnerResponseSchema } from "../assessment-response-schemas";
import { ItemResponseRenderer } from "../../item-registry/components/renderers/item-response-renderer";
import { getItemTypeVisual } from "../../item-registry/components/item-type-config";

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
  const itemStartedAtRef = useRef<Map<string, number>>(new Map());
  const attemptStartedRef = useRef(false);

  const activeItem: RunnerItem | undefined = attempt.items[activeIndex];
  const activeVisual = getItemTypeVisual(activeItem?.itemTypeKey ?? "mcq_single");

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
    if (attemptStartedRef.current) return;
    attemptStartedRef.current = true;
    captureProductEvent("assessment_attempt_started", {
      routeGroup: "learner",
      source: "attempt_runner",
    });
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    if (!itemStartedAtRef.current.has(activeItem.assessmentItemId)) {
      itemStartedAtRef.current.set(activeItem.assessmentItemId, Date.now());
    }
  }, [activeItem?.assessmentItemId]);

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
    const startedAt = itemStartedAtRef.current.get(item.assessmentItemId) ?? Date.now();
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const answerWithLatency = { ...answerJson, latencyMs };

    try {
      await clientApi.post(
        `/api/v1/attempts/${attempt.id}/answers`,
        { itemId: item.itemId, answerJson: answerWithLatency },
        `attempt-answer-${item.assessmentItemId}`,
      );
      setAttempt((current) => ({
        ...current,
        items: current.items.map((entry) =>
          entry.assessmentItemId === item.assessmentItemId
            ? { ...entry, savedAnswer: answerWithLatency }
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
      captureProductEvent("assessment_submitted", {
        routeGroup: "learner",
        source: "attempt_runner",
        outcome: "submitted",
      });
      router.push(`/attempts/${attempt.id}/result`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-theme space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm">
        <div>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Attempt in progress</p>
          <h1 className="text-2xl font-semibold text-[var(--admin-on-surface)]">Assessment attempt</h1>
        </div>
        <div className="text-right text-sm text-[var(--admin-on-surface-variant)]">
          {timerLabel ? <p>Time remaining: {timerLabel}</p> : null}
          <p>
            Autosave:{" "}
            <span
              className={
                autosaveState === "saved"
                  ? "font-semibold text-[var(--admin-success)]"
                  : autosaveState === "error"
                    ? "font-semibold text-[var(--admin-danger)]"
                    : "font-semibold text-[var(--admin-on-surface)]"
              }
            >
              {autosaveState === "saving"
                ? "Saving..."
                : autosaveState === "saved"
                  ? "Saved"
                  : autosaveState === "error"
                    ? "Error"
                    : "Idle"}
            </span>
          </p>
        </div>
      </header>

      {attempt.secureMode ? (
        <p className="rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-3 text-sm text-[var(--admin-warning)]">
          Secure mode is active. Copy/paste and navigation may be restricted.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]">
          {activeItem ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--admin-on-surface-variant)]">
                  Question {activeIndex + 1} of {attempt.items.length}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${activeVisual.badgeClassName}`}
                >
                  {activeItem.itemTypeKey.replaceAll("_", " ")}
                </span>
              </div>

              <ItemResponseRenderer
                key={activeItem.assessmentItemId}
                itemTypeKey={activeItem.itemTypeKey}
                stem={(activeItem.contentJson as { stem?: string }).stem ?? "Question"}
                savedAnswer={
                  activeItem.savedAnswer && typeof activeItem.savedAnswer === "object"
                    ? activeItem.savedAnswer
                    : null
                }
                options={activeItem.options.map((option) => ({
                  id: option.id,
                  optionJson: option.optionJson,
                  isCorrect: null,
                  position: option.position,
                }))}
                onAnswerChange={(answerJson) => {
                  if (!answerJson) return;
                  void saveAnswer(activeItem, answerJson);
                }}
                mode="attempt"
                showStem={activeItem.itemTypeKey !== "swipe"}
              />
            </>
          ) : (
            <p className="text-[var(--admin-on-surface-variant)]">No questions available.</p>
          )}
        </section>

        <nav className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm">
          <h2 className="font-medium text-[var(--admin-on-surface)]">Navigator</h2>
          <ol className="mt-3 grid grid-cols-4 gap-2">
            {attempt.items.map((item, index) => (
              <li key={item.assessmentItemId}>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-2 py-2 text-sm transition-[background-color,border-color,transform] duration-200 motion-safe:active:scale-[0.98] ${
                    index === activeIndex
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_35%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                  }`}
                  onClick={() => {
                    setActiveIndex(index);
                  }}
                >
                  {index + 1}
                  {item.savedAnswer ? "•" : ""}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {error ? <p className="text-sm text-[var(--admin-danger)]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] motion-safe:active:scale-[0.98] disabled:opacity-60"
          disabled={submitting}
          onClick={() => {
            void handleSubmit();
          }}
        >
          {submitting ? "Submitting..." : "Submit attempt"}
        </button>
        <Link
          href={`/assessments/${attempt.assessmentId}`}
          className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
