"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError } from "../../../lib/client-api";
import { diagnosticApiClient } from "@/modules/diagnostics/diagnostic.api-client";
import type { DiagnosticQuestion } from "@atlas/contracts/diagnostics/diagnostic.types";
import { captureProductEvent } from "../../../observability/capture-product-event";
import { sendAttributionEvent } from "../../../lib/attribution/utm-storage";
import { DeferredDiagnosticIdentityGate as DiagnosticIdentityGate } from "./DeferredDiagnosticIdentityGate";
import { DiagnosticQuestionCard } from "./DiagnosticQuestionCard";

type RunnerState =
  | { kind: "loading" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "unavailable"; message: string }
  | {
      kind: "ready";
      anonymousId: string;
      title: string;
      items: DiagnosticQuestion[];
    }
  | { kind: "submitting" }
  | { kind: "completed"; anonymousId: string };

export function PublicDiagnosticRunner() {
  const router = useRouter();
  const [state, setState] = useState<RunnerState>({ kind: "loading" });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [identityGateOpen, setIdentityGateOpen] = useState(false);

  async function startDiagnostic() {
    setState({ kind: "loading" });

    try {
      const response = await diagnosticApiClient.startPublicDiagnostic({ operation: "start" });
      if ("items" in response.data) {
        captureProductEvent("diagnostic_started", {
          routeGroup: "public",
          source: "public_diagnostic",
        });
        void sendAttributionEvent({ eventType: "started_diagnostic" });
        setState({
          kind: "ready",
          anonymousId: response.data.anonymousId,
          title: response.data.title,
          items: response.data.items,
        });
        setCurrentIndex(0);
        setAnswers({});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start diagnostic.";
      const unavailable =
        error instanceof ClientApiError && (error.status === 503 || error.status === 429);
      setState({
        kind: unavailable ? "unavailable" : "error",
        message,
        retryable: true,
      });
    }
  }

  useEffect(() => {
    void startDiagnostic();
  }, []);

  const currentQuestion = state.kind === "ready" ? state.items[currentIndex] : null;
  const progressPercent = useMemo(() => {
    if (state.kind !== "ready" || state.items.length === 0) return 0;
    return Math.round(((currentIndex + 1) / state.items.length) * 100);
  }, [state, currentIndex]);

  async function completeDiagnostic() {
    if (state.kind !== "ready") return;

    const unanswered = state.items.some((item) => !answers[item.itemId]);
    if (unanswered) {
      setState({
        kind: "error",
        message: "Please answer every question before submitting.",
        retryable: false,
      });
      return;
    }

    setState({ kind: "submitting" });

    try {
      const response = await diagnosticApiClient.startPublicDiagnostic({
        operation: "complete",
        anonymousId: state.anonymousId,
        answers: state.items.map((item) => ({
          itemId: item.itemId,
          answerJson: { selectedOptionId: answers[item.itemId] },
        })),
      });

      if ("resultPath" in response.data) {
        captureProductEvent("diagnostic_completed", {
          routeGroup: "public",
          source: "public_diagnostic",
          outcome: "completed",
        });
        setState({ kind: "completed", anonymousId: response.data.anonymousId });
        setIdentityGateOpen(true);
      }
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to submit diagnostic.",
        retryable: true,
      });
    }
  }

  if (state.kind === "loading" || state.kind === "submitting") {
    return (
      <p role="status">
        {state.kind === "loading" ? "Starting diagnostic…" : "Submitting answers…"}
      </p>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <section className="rounded border p-4">
        <h1 className="text-xl font-semibold">Diagnostic unavailable</h1>
        <p className="mt-2 text-sm opacity-80">{state.message}</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="rounded border p-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm opacity-80">{state.message}</p>
        {state.retryable ? (
          <button
            type="button"
            className="mt-4 rounded border px-4 py-2"
            onClick={() => void startDiagnostic()}
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  if (state.kind === "completed") {
    return (
      <>
        <section className="rounded border p-4">
          <h1 className="text-xl font-semibold">Diagnostic complete</h1>
          <p className="mt-2 text-sm opacity-80">
            Create a free account to save your results, or continue to your preliminary scorecard.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={() => {
                setIdentityGateOpen(true);
              }}
            >
              Save my results
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={() => {
                router.push(`/diagnostic/result?anonId=${state.anonymousId}`);
              }}
            >
              View scorecard
            </button>
          </div>
        </section>
        <DiagnosticIdentityGate
          anonymousId={state.anonymousId}
          open={identityGateOpen}
          onClose={() => {
            setIdentityGateOpen(false);
          }}
        />
      </>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{state.title}</h1>
        <p className="mt-1 text-sm opacity-80">
          Educational self-assessment. Results are not financial advice.
        </p>
      </header>

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
      <p className="text-sm">{String(progressPercent)}% complete</p>

      <DiagnosticQuestionCard
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={state.items.length}
        selectedOptionId={answers[currentQuestion.itemId] ?? null}
        onSelectOption={(optionId) => {
          setAnswers((current) => ({ ...current, [currentQuestion.itemId]: optionId }));
        }}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded border px-4 py-2"
          disabled={currentIndex === 0}
          onClick={() => {
            setCurrentIndex((index) => Math.max(index - 1, 0));
          }}
        >
          Previous
        </button>
        {currentIndex < state.items.length - 1 ? (
          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => {
              setCurrentIndex((index) => Math.min(index + 1, state.items.length - 1));
            }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="rounded border px-4 py-2 font-medium"
            onClick={() => void completeDiagnostic()}
          >
            Finish diagnostic
          </button>
        )}
      </div>
    </div>
  );
}
