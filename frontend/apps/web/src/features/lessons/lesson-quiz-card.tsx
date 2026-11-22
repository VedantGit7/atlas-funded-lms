"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import type { z } from "zod";
import type { lessonQuizSummarySchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ProctoringConsentModal } from "../assessments/components/proctoring-consent-modal";
import { useStartAttempt } from "../assessments/lib/use-start-attempt";

type QuizSummary = z.infer<typeof lessonQuizSummarySchema>;

const cardClassName = "space-y-4 rounded-xl border border-border bg-card p-5";
const primaryActionClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryActionClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function minutes(seconds: number): string {
  const value = Math.max(1, Math.round(seconds / 60));
  return `${String(value)} minute${value === 1 ? "" : "s"}`;
}

function percent(value: number): string {
  return `${String(Math.round(value * 10) / 10)}%`;
}

function Rules({ quiz }: { quiz: QuizSummary }) {
  const rows: Array<[string, string]> = [
    ["Questions", String(quiz.questionCount)],
    ["Pass mark", percent(quiz.passMarkPercent)],
    ["Time limit", quiz.timeLimitSeconds ? minutes(quiz.timeLimitSeconds) : "None"],
    ["Attempts left", `${String(quiz.attemptsRemaining)} of ${String(quiz.attemptsAllowed)}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-muted px-3 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-semibold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LastAttempt({ quiz }: { quiz: QuizSummary }) {
  const last = quiz.lastAttempt;
  if (!last) return null;
  const resultLink = (
    <Link
      href={`/attempts/${encodeURIComponent(last.id)}/result`}
      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
    >
      See the result
    </Link>
  );
  if (last.status === "SUBMITTED" && last.scorePercent == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your last attempt is waiting for your instructor to mark it. {resultLink}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Last attempt: {last.scorePercent != null ? percent(last.scorePercent) : "not scored"}
      {last.passed === false ? ", not a pass." : last.passed === true ? ", passed." : "."}{" "}
      {resultLink}
    </p>
  );
}

/**
 * A quiz inside a lesson: the rules, where the learner stands, and a Start,
 * Resume or Retake button (QA review 1 C6, review 2 C5). Passing the quiz
 * completes the lesson. In the Studio preview the buttons are shown but off.
 */
export function LessonQuizCard({
  assessmentId,
  quiz,
  preview = false,
}: {
  assessmentId: string;
  quiz: QuizSummary;
  preview?: boolean;
}) {
  const attempt = useStartAttempt({ assessmentId, proctoringLevel: quiz.proctoringLevel });
  const retake = quiz.attemptsUsed > 0;

  let action;
  if (preview) {
    action = (
      <div className="space-y-2">
        <button type="button" disabled className={primaryActionClassName}>
          Start quiz
        </button>
        <p className="text-xs text-muted-foreground">Learners start the quiz from here.</p>
      </div>
    );
  } else if (!quiz.available) {
    action = <p className="text-sm text-muted-foreground">This quiz isn&apos;t open yet.</p>;
  } else if (quiz.inProgressAttemptId) {
    action = (
      <Link
        href={`/attempts/${encodeURIComponent(quiz.inProgressAttemptId)}`}
        className={primaryActionClassName}
      >
        Resume quiz
      </Link>
    );
  } else if (quiz.questionCount === 0) {
    action = <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>;
  } else if (quiz.attemptsRemaining <= 0) {
    action = (
      <p className="text-sm text-muted-foreground">
        You&apos;ve used all your attempts. Ask your instructor if you need another one.
      </p>
    );
  } else {
    action = (
      <button
        type="button"
        onClick={attempt.start}
        disabled={attempt.starting}
        className={quiz.passed ? secondaryActionClassName : primaryActionClassName}
      >
        {attempt.starting ? "Starting…" : retake ? "Retake quiz" : "Start quiz"}
      </button>
    );
  }

  return (
    <section className={cardClassName} aria-label="Quiz">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground">{quiz.title}</h2>
        </div>
        {quiz.passed ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Passed
            {quiz.bestScorePercent != null ? ` · best ${percent(quiz.bestScorePercent)}` : ""}
          </p>
        ) : null}
      </div>

      <Rules quiz={quiz} />

      {quiz.proctoringLevel >= 1 ? (
        <p className="text-sm text-muted-foreground">
          This quiz records integrity signals, such as leaving the tab. You&apos;ll be asked to
          agree before it starts.
        </p>
      ) : null}

      <LastAttempt quiz={quiz} />

      {/* Learners see this under the lesson, where "Mark complete" used to be. */}
      {preview ? (
        <p className="text-sm text-muted-foreground">
          Learners complete this lesson by passing the quiz.
        </p>
      ) : null}

      {action}
      {attempt.error ? (
        <p role="alert" className="text-sm text-destructive-text">
          {attempt.error}
        </p>
      ) : null}

      <ProctoringConsentModal
        open={attempt.consentOpen}
        confirming={attempt.starting}
        level={attempt.consentLevel}
        onCancel={attempt.cancelConsent}
        onConfirm={attempt.confirmConsent}
      />
    </section>
  );
}
