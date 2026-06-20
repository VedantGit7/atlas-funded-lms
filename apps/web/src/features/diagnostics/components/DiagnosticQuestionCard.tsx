"use client";

import type { DiagnosticQuestion } from "../../../modules/diagnostics/diagnostic.types";

type DiagnosticQuestionCardProps = {
  question: DiagnosticQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId?: string | null;
  onSelectOption: (optionId: string) => void;
  disabled?: boolean;
};

export function DiagnosticQuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onSelectOption,
  disabled = false,
}: DiagnosticQuestionCardProps) {
  const stem =
    typeof question.contentJson["stem"] === "string" ? question.contentJson["stem"] : "Question";

  return (
    <section
      aria-labelledby={`question-${question.assessmentItemId}`}
      className="rounded border p-4"
    >
      <p className="mb-2 text-sm opacity-70">
        Question {questionNumber} of {totalQuestions}
      </p>
      <h2 id={`question-${question.assessmentItemId}`} className="mb-4 text-lg font-semibold">
        {stem}
      </h2>
      <fieldset disabled={disabled}>
        <legend className="sr-only">Answer options</legend>
        <ul className="space-y-2">
          {question.options.map((option) => {
            const label =
              typeof option.optionJson["label"] === "string"
                ? option.optionJson["label"]
                : `Option ${String(option.position)}`;

            return (
              <li key={option.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded border p-3">
                  <input
                    type="radio"
                    name={`question-${question.assessmentItemId}`}
                    value={option.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => {
                      onSelectOption(option.id);
                    }}
                  />
                  <span>{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </section>
  );
}
