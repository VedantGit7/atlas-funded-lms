"use client";

import Link from "next/link";
import type { z } from "zod";
import type { attemptRunnerResponseSchema } from "../assessment-response-schemas";

type AttemptResult = z.infer<typeof attemptRunnerResponseSchema>["data"];

type AttemptResultPanelProps = {
  attempt: AttemptResult;
};

export function AttemptResultPanel({ attempt }: AttemptResultPanelProps) {
  const pending = attempt.requiresManualGrading === true;
  const passed =
    attempt.passed === true ? "Passed" : attempt.passed === false ? "Did not pass" : "Pending";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Attempt result</h1>
        {attempt.submittedAt ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted {new Date(attempt.submittedAt).toLocaleString()}
          </p>
        ) : null}
      </header>

      <section className="rounded border p-4">
        <h2 className="font-medium">Score summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>{attempt.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Score</dt>
            <dd>{attempt.scorePercent != null ? `${String(attempt.scorePercent)}%` : "Pending"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Result</dt>
            <dd>{pending ? "Pending manual grading" : passed}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Pass mark</dt>
            <dd>{attempt.passMarkPercent ?? "—"}%</dd>
          </div>
        </dl>
      </section>

      {attempt.canReviewAnswers && attempt.items.length > 0 ? (
        <section className="rounded border p-4">
          <h2 className="font-medium">Answer review</h2>
          <ol className="mt-3 space-y-3">
            {attempt.items.map((item, index) => (
              <li key={item.assessmentItemId} className="rounded border p-3 text-sm">
                <p className="font-medium">
                  Question {index + 1}:{" "}
                  {(item.contentJson as { stem?: string }).stem ?? item.itemTypeKey}
                </p>
                <p className="mt-2">Your answer: {JSON.stringify(item.savedAnswer ?? {})}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Answer review is not available for this attempt.
        </p>
      )}

      <Link
        href={`/assessments/${attempt.assessmentId}`}
        className="inline-block rounded border px-4 py-2"
      >
        Back to assessment
      </Link>
    </div>
  );
}
