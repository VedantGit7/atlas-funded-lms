"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatGradingApiError, gradeGradingTask, type GradingTaskDetail } from "../api";

type GradingDetailPanelProps = {
  task: GradingTaskDetail;
};

export function GradingDetailPanel({ task }: GradingDetailPanelProps) {
  const router = useRouter();
  const scoreInputId = useId();
  const feedbackInputId = useId();
  const [score, setScore] = useState(
    task.existingGrade != null ? String(task.existingGrade.score) : "",
  );
  const [feedback, setFeedback] = useState(task.existingGrade?.feedback ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isGraded = task.status === "GRADED";

  const handleSubmit = useCallback(async () => {
    if (submitting || isGraded) {
      return;
    }

    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > task.possiblePoints) {
      setErrorMessage(`Score must be between 0 and ${String(task.possiblePoints)}.`);
      return;
    }

    if (!feedback.trim()) {
      setErrorMessage("Feedback is required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await gradeGradingTask(task.id, {
        score: parsedScore,
        feedback: feedback.trim(),
      });
      setSuccessMessage("Grade submitted successfully.");
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatGradingApiError(error));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [feedback, isGraded, router, score, submitting, task.id, task.possiblePoints]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm opacity-80">{task.assessment.title}</p>
          <h2 className="text-xl font-semibold">{task.learner.displayName}</h2>
        </div>
        <Link href="/studio/grading" className="text-sm underline-offset-2 hover:underline">
          Back to queue
        </Link>
      </div>

      <section className="rounded border p-4" aria-label="Learner answers">
        <h3 className="mb-3 text-lg font-medium">Answers</h3>
        <div className="space-y-4">
          {task.answers.map((answer) => (
            <article key={answer.assessmentItemId} className="rounded border p-4">
              <p className="text-xs uppercase tracking-wide opacity-70">{answer.itemType}</p>
              <p className="mt-1 font-medium">{answer.prompt}</p>
              <div className="mt-3 rounded bg-neutral-50 p-3 text-sm">
                <pre className="whitespace-pre-wrap font-sans">
                  {JSON.stringify(answer.learnerAnswer, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-sm opacity-80">Possible points: {answer.possiblePoints}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border p-4" aria-label="Proctoring timeline">
        <h3 className="mb-3 text-lg font-medium">Proctoring timeline</h3>
        {task.proctoringTimeline.length === 0 ? (
          <p className="text-sm opacity-80">No L1 proctoring events recorded for this attempt.</p>
        ) : (
          <ul className="space-y-2">
            {task.proctoringTimeline.map((event) => (
              <li key={event.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{event.eventType}</p>
                <p className="opacity-80">
                  {new Date(event.occurredAt).toLocaleString()} · {event.severity}
                </p>
                {event.summary ? <p className="mt-1">{event.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {task.proctoringReport ? (
          <div className="mt-4 rounded border p-3 text-sm">
            <p className="font-medium">Report summary</p>
            <p>{task.proctoringReport.summary}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded border p-4" aria-label="Scoring panel">
        <h3 className="mb-3 text-lg font-medium">Scoring</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={scoreInputId} className="block text-sm font-medium">
              Score
            </label>
            <input
              id={scoreInputId}
              type="number"
              min={0}
              max={task.possiblePoints}
              step="0.01"
              value={score}
              onChange={(event) => {
                setScore(event.target.value);
              }}
              disabled={isGraded || submitting}
              className="mt-1 w-full rounded border px-3 py-2"
            />
            <p className="mt-1 text-xs opacity-70">Maximum score: {task.possiblePoints}</p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor={feedbackInputId} className="block text-sm font-medium">
              Feedback
            </label>
            <textarea
              id={feedbackInputId}
              rows={5}
              value={feedback}
              onChange={(event) => {
                setFeedback(event.target.value);
              }}
              disabled={isGraded || submitting}
              className="mt-1 w-full rounded border px-3 py-2"
              required
            />
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-700" role="alert" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="mt-4 text-sm text-green-700" role="status" aria-live="polite">
            {successMessage}
          </p>
        ) : null}

        {isGraded ? (
          <p className="mt-4 text-sm font-medium">This task has been graded and is locked.</p>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={submitting}
              onClick={() => {
                setConfirmOpen(true);
              }}
            >
              Finalize grade
            </button>
          </div>
        )}
      </section>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finalize-grade-title"
        >
          <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h4 id="finalize-grade-title" className="text-lg font-semibold">
              Finalize grade?
            </h4>
            <p className="mt-2 text-sm opacity-80">
              Submit score {score || "0"} / {task.possiblePoints} with feedback for{" "}
              {task.learner.displayName}. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded border px-4 py-2 text-sm"
                disabled={submitting}
                onClick={() => {
                  setConfirmOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={submitting}
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {submitting ? "Submitting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
