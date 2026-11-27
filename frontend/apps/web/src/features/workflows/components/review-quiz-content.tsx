"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type {
  ReviewQuiz,
  WorkflowContentResponse,
} from "@atlas/contracts/workflows/workflow-content.schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { itemDisplayTitle } from "../../assessments/assessment-studio-shared";
import { questionTypeName } from "../../item-registry/components/question-picker-dialog";

function plural(count: number, one: string, many: string): string {
  const shown = Number.isInteger(count) ? String(count) : String(Number(count.toFixed(2)));
  return `${shown} ${count === 1 ? one : many}`;
}

/** A quiz's rules in one line, as the learner meets them. */
export function reviewQuizRules(quiz: ReviewQuiz): string {
  const count = quiz.questions.length;
  const parts = [
    quiz.questionsPerAttempt != null && quiz.questionsPerAttempt < count
      ? `${String(quiz.questionsPerAttempt)} of ${plural(count, "question", "questions")} per attempt, at random`
      : plural(count, "question", "questions"),
    plural(quiz.totalMarks, "mark", "marks"),
    `pass at ${String(quiz.passMarkPercent)}%`,
    plural(quiz.attemptsAllowed, "attempt", "attempts"),
  ];
  if (quiz.timeLimitSeconds != null)
    parts.push(`${String(Math.round(quiz.timeLimitSeconds / 60))} min`);
  if (quiz.negativeMarkPercent > 0) {
    parts.push(`wrong answers lose ${String(Number(quiz.negativeMarkPercent.toFixed(2)))}%`);
  }
  return parts.join(" · ");
}

/**
 * The questions a reviewer is approving (QA review 2 4.1): each quiz in the
 * course, or the quiz itself, with every question, its marks and its correct
 * answer. The review used to show only the title and status.
 */
export function ReviewQuizContent({ transitionId }: { transitionId: string }) {
  const [quizzes, setQuizzes] = useState<ReviewQuiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQuizzes(null);
    setError(null);
    clientApi
      .get<WorkflowContentResponse>(`/api/v1/workflows/${transitionId}/content`)
      .then((response) => {
        if (!cancelled) setQuizzes(response.data.quizzes);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ClientApiError ? err.message : "The questions couldn't be loaded.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [transitionId]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--admin-danger)]">
        {error}
      </p>
    );
  }
  if (quizzes == null) {
    return <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading the questions…</p>;
  }
  if (quizzes.length === 0) return null;

  return (
    <section aria-labelledby="review-quiz-heading" className="space-y-4">
      <h3
        id="review-quiz-heading"
        className="text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface)]"
      >
        Quiz questions
      </h3>
      {quizzes.map((quiz) => (
        <details
          key={quiz.assessmentId}
          className="group overflow-hidden rounded-xl border border-[var(--admin-border)]"
          open={quizzes.length === 1}
        >
          <summary className="cursor-pointer list-none bg-[var(--admin-surface-low)] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/40">
            <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
              {quiz.lessonTitle ?? quiz.title}
              {quiz.sectionTitle ? (
                <span className="font-normal text-[var(--admin-on-surface-variant)]">
                  {" "}
                  · {quiz.sectionTitle}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
              {reviewQuizRules(quiz)}
            </span>
          </summary>
          {quiz.questions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--admin-warning)]">
              This quiz has no questions, so learners won&apos;t get it until it does.
            </p>
          ) : (
            <ol className="divide-y divide-[var(--admin-border)]">
              {quiz.questions.map((question, index) => (
                <li key={`${quiz.assessmentId}-${String(question.position)}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-[var(--admin-on-surface)]">
                      <span className="mr-2 font-semibold tabular-nums text-[var(--admin-on-surface-variant)]">
                        {index + 1}.
                      </span>
                      {itemDisplayTitle(question.contentJson)}
                    </p>
                    <span className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]">
                      {plural(question.points, "mark", "marks")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    {questionTypeName(question.itemTypeKey)}
                  </p>
                  {question.choices.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {question.choices.map((choice, choiceIndex) => (
                        <li
                          key={`${choice.label}-${String(choiceIndex)}`}
                          className={`flex items-start gap-2 text-sm ${
                            choice.correct
                              ? "font-medium text-[var(--admin-success)]"
                              : "text-[var(--admin-on-surface-variant)]"
                          }`}
                        >
                          {choice.correct ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-label="Correct" />
                          ) : (
                            <span className="w-4 shrink-0" aria-hidden="true" />
                          )}
                          {choice.label}
                        </li>
                      ))}
                    </ul>
                  ) : question.correctAnswer.length > 0 ? (
                    <p className="mt-2 text-sm text-[var(--admin-on-surface)]">
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {question.correctAnswerLabel}:{" "}
                      </span>
                      {question.correctAnswer.join("; ")}
                    </p>
                  ) : null}
                  {question.explanation ? (
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Explanation: {question.explanation}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </details>
      ))}
    </section>
  );
}
