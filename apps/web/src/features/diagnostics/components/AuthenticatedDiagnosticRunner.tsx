"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi } from "../../../lib/client-api";
import type { DiagnosticQuestion } from "../../../modules/diagnostics/diagnostic.types";
import { DiagnosticQuestionCard } from "./DiagnosticQuestionCard";

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
  const [items] = useState(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"running" | "submitting" | "error">("running");
  const [message, setMessage] = useState<string | null>(null);

  const currentQuestion = items[currentIndex];
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
      router.push(`/diagnostic/me/${sessionId}/result`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit diagnostic.");
    }
  }

  useEffect(() => {
    router.refresh();
  }, [router]);

  if (!currentQuestion) {
    return <p>No diagnostic questions are available.</p>;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm opacity-80">
          Complete your authenticated diagnostic assessment.
        </p>
      </header>

      {message ? <p role="alert">{message}</p> : null}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label={`Progress ${String(progressPercent)}%`}
        className="h-2 rounded bg-muted"
      >
        <div
          className="h-2 rounded bg-foreground"
          style={{ width: `${String(progressPercent)}%` }}
        />
      </div>

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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded border px-4 py-2"
          disabled={currentIndex === 0 || status === "submitting"}
          onClick={() => {
            setCurrentIndex((index) => Math.max(index - 1, 0));
          }}
        >
          Previous
        </button>
        {currentIndex < items.length - 1 ? (
          <button
            type="button"
            className="rounded border px-4 py-2"
            disabled={status === "submitting"}
            onClick={() => {
              setCurrentIndex((index) => Math.min(index + 1, items.length - 1));
            }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="rounded border px-4 py-2 font-medium"
            disabled={status === "submitting"}
            onClick={() => void submitDiagnostic()}
          >
            {status === "submitting" ? "Submitting…" : "Submit diagnostic"}
          </button>
        )}
      </div>
    </div>
  );
}
