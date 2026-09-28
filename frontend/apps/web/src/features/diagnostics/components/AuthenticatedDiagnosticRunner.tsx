"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "../../../components/motion/animation-boundary";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { clientApi } from "../../../lib/client-api";
import { captureProductEvent } from "../../../observability/capture-product-event";
import type { DiagnosticQuestion } from "@atlas/contracts/diagnostics/diagnostic.types";
import { DiagnosticQuestionCard } from "./DiagnosticQuestionCard";

const EASE = [0.16, 1, 0.3, 1] as const;

type AuthenticatedDiagnosticRunnerProps = {
  sessionId: string;
  attemptId: string;
  title: string;
  initialItems: DiagnosticQuestion[];
};

export function AuthenticatedDiagnosticRunner({
  sessionId,
  attemptId,
  title,
  initialItems,
}: AuthenticatedDiagnosticRunnerProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [items] = useState(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"running" | "submitting" | "error">("running");
  const [message, setMessage] = useState<string | null>(null);

  const currentQuestion = items[currentIndex];
  const isLast = currentIndex === items.length - 1;
  const answeredCount = useMemo(
    () => items.filter((item) => answers[item.itemId]).length,
    [items, answers],
  );
  const progressPercent = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(((currentIndex + 1) / items.length) * 100);
  }, [currentIndex, items.length]);

  async function submitDiagnostic() {
    const unanswered = items.some((item) => !answers[item.itemId]);
    if (unanswered) {
      setMessage("Please answer every question before submitting.");
      return;
    }

    setStatus("submitting");
    setMessage(null);

    try {
      for (const item of items) {
        await clientApi.post(
          `/api/v1/attempts/${attemptId}/answers`,
          {
            itemId: item.itemId,
            answerJson: { selectedOptionId: answers[item.itemId] },
          },
          `attempt-answer-${item.itemId}`,
        );
      }

      await clientApi.post(
        `/api/v1/attempts/${attemptId}/submit`,
        {},
        `attempt-submit-${attemptId}`,
      );
      captureProductEvent("diagnostic_completed", {
        routeGroup: "learner",
        source: "authenticated_diagnostic",
        outcome: "completed",
      });
      router.push(`/diagnostic/me/${sessionId}/result`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit diagnostic.");
    }
  }

  useEffect(() => {
    captureProductEvent("diagnostic_started", {
      routeGroup: "learner",
      source: "authenticated_diagnostic",
    });
    router.refresh();
  }, [router]);

  if (!currentQuestion) {
    return (
      <main className="mx-auto w-full max-w-2xl px-1 py-10">
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No diagnostic questions are available.
        </p>
      </main>
    );
  }

  return (
    <div className="relative isolate">
      {/* Editorial dot-grid canvas — adapts to light/dark, purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background-image:radial-gradient(color-mix(in_srgb,var(--foreground)_9%,transparent)_1px,transparent_1px)] [background-size:24px_24px]"
      />

      <main className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {title}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Question {currentIndex + 1} of {items.length}
              </h1>
            </div>
            <p className="hidden text-right text-xs italic text-muted-foreground sm:block">
              Your answers shape your results.
            </p>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={`Progress ${String(progressPercent)}%`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: `${String(progressPercent)}%` }}
              animate={{ width: `${String(progressPercent)}%` }}
              transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
            />
          </div>
        </header>

        {message ? (
          <p
            role="alert"
            className="rounded-xl border border-[color-mix(in_srgb,var(--destructive)_40%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] p-3 text-sm text-destructive"
          >
            {message}
          </p>
        ) : null}

        <DiagnosticQuestionCard
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={items.length}
          selectedOptionId={answers[currentQuestion.itemId] ?? null}
          onSelectOption={(optionId) => {
            setAnswers((current) => ({ ...current, [currentQuestion.itemId]: optionId }));
          }}
          disabled={status === "submitting"}
        />

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={currentIndex === 0 || status === "submitting"}
            onClick={() => {
              setCurrentIndex((index) => Math.max(index - 1, 0));
            }}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Previous
          </button>

          <span className="order-first text-center text-xs text-muted-foreground sm:order-none">
            {answeredCount} of {items.length} answered
          </span>

          {isLast ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              disabled={status === "submitting"}
              onClick={() => void submitDiagnostic()}
            >
              {status === "submitting" ? "Submitting…" : "Submit diagnostic"}
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              disabled={status === "submitting"}
              onClick={() => {
                setCurrentIndex((index) => Math.min(index + 1, items.length - 1));
              }}
            >
              Next question
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </main>

      {/* Contextual data-viz backdrop (decorative). */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-6 right-6 hidden opacity-[0.08] lg:block"
      >
        <div className="h-56 w-56 border-b border-l border-foreground">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100" fill="none">
            <path
              d="M0 80 Q 25 70, 40 40 T 80 10"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-foreground"
            />
            <circle cx="40" cy="40" r="1.5" fill="currentColor" className="text-foreground" />
            <circle cx="80" cy="10" r="1.5" fill="currentColor" className="text-foreground" />
          </svg>
        </div>
      </div>
    </div>
  );
}
