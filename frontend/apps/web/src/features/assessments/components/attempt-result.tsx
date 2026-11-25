"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { z } from "zod";
import type { attemptRunnerResponseSchema } from "../assessment-response-schemas";
import { academyDateTimeFormat } from "../../../lib/format/academy-format";

type AttemptResult = z.infer<typeof attemptRunnerResponseSchema>["data"];
type ResultItem = AttemptResult["items"][number];

type AttemptResultPanelProps = {
  attempt: AttemptResult;
};

const primaryActionClassName =
  "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const secondaryActionClassName =
  "inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function percent(value: number): string {
  return `${String(Math.round(value * 10) / 10)}%`;
}

/** Shown in the learner's own locale, once the page runs in the browser. */
function SubmittedAt({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(
      academyDateTimeFormat({ dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)),
    );
  }, [iso]);
  return label ? (
    <p className="text-sm text-muted-foreground">
      Submitted <time dateTime={iso}>{label}</time>
    </p>
  ) : null;
}

function Verdict({ review }: { review: NonNullable<ResultItem["review"]> }) {
  if (review.markedByInstructor) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Marked by your instructor
      </span>
    );
  }
  if (review.isCorrect) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Correct
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-destructive-text">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {review.yourAnswer.length === 0 ? "Not answered" : "Incorrect"}
    </span>
  );
}

function Lines({ lines }: { lines: string[] }) {
  if (lines.length === 1) return <p className="text-sm text-foreground">{lines[0]}</p>;
  return (
    <ul className="space-y-0.5 text-sm text-foreground">
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`}>{line}</li>
      ))}
    </ul>
  );
}

function ReviewItem({ item, index }: { item: ResultItem; index: number }) {
  const review = item.review;
  const stem = (item.contentJson as { stem?: unknown }).stem;
  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {index + 1}. {typeof stem === "string" && stem.trim() ? stem : "Question"}
        </p>
        {review ? <Verdict review={review} /> : null}
      </div>
      {review ? (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your answer
            </p>
            {review.yourAnswer.length > 0 ? (
              <Lines lines={review.yourAnswer} />
            ) : (
              <p className="text-sm text-muted-foreground">No answer</p>
            )}
          </div>
          {review.correctAnswer.length > 0 && !review.isCorrect ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {review.correctAnswerLabel}
              </p>
              <Lines lines={review.correctAnswer} />
            </div>
          ) : null}
          {review.explanation ? (
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Explanation
              </p>
              <p className="text-sm text-foreground">{review.explanation}</p>
            </div>
          ) : null}
          {review.pointsAwarded != null ? (
            <p className="text-xs text-muted-foreground">
              {review.pointsAwarded} of {review.points} point{review.points === 1 ? "" : "s"}
            </p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * A quiz attempt's result (QA review 2 H23): the score and whether it passed,
 * then, when the quiz allows it, each answer and the correct one in words
 * with the author's explanation. Never shows raw data.
 */
export function AttemptResultPanel({ attempt }: AttemptResultPanelProps) {
  const pending = attempt.requiresManualGrading === true || attempt.scorePercent == null;
  const passed = attempt.passed === true;
  const lessonHref = attempt.lesson
    ? `/courses/${attempt.lesson.courseId}/lessons/${attempt.lesson.lessonId}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Quiz result</p>
        <h1 className="text-2xl font-semibold text-foreground">{attempt.title ?? "Quiz"}</h1>
        {attempt.submittedAt ? <SubmittedAt iso={attempt.submittedAt} /> : null}
      </header>

      <section
        aria-label="Score"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
      >
        {pending ? (
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">Waiting for marking</p>
            <p className="text-sm text-muted-foreground">
              Some answers are marked by your instructor. Your score appears here once they are.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-4xl font-semibold tabular-nums text-foreground">
              {percent(attempt.scorePercent ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">
              Pass mark {percent(attempt.passMarkPercent ?? 0)}
            </p>
          </div>
        )}
        {pending ? null : passed ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Passed
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] px-3 py-1 text-sm font-semibold text-destructive-text">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Not passed
          </p>
        )}
      </section>

      {passed && attempt.lesson ? (
        <p className="text-sm text-muted-foreground">
          The lesson &ldquo;{attempt.lesson.title}&rdquo; is now complete.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {lessonHref ? (
          <Link href={lessonHref} className={primaryActionClassName}>
            {passed || pending ? "Back to lesson" : "Back to lesson to try again"}
          </Link>
        ) : null}
        <Link
          href={`/assessments/${attempt.assessmentId}`}
          className={lessonHref ? secondaryActionClassName : primaryActionClassName}
        >
          Quiz overview
        </Link>
      </div>

      {attempt.canReviewAnswers && attempt.items.length > 0 ? (
        <section aria-labelledby="answer-review" className="space-y-3">
          <h2 id="answer-review" className="text-lg font-semibold text-foreground">
            Your answers
          </h2>
          <ol className="space-y-3">
            {attempt.items.map((item, index) => (
              <ReviewItem key={item.assessmentItemId} item={item} index={index} />
            ))}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          This quiz doesn&apos;t show answers for this attempt.
        </p>
      )}
    </div>
  );
}
