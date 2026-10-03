"use client";

import { cn } from "@atlas/design-system";
import type { DiagnosticQuestion } from "@atlas/contracts/diagnostics/diagnostic.types";

type DiagnosticQuestionCardProps = {
  question: DiagnosticQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId?: string | null;
  onSelectOption: (optionId: string) => void;
  disabled?: boolean;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function DiagnosticQuestionCard({
  question,
  selectedOptionId,
  onSelectOption,
  disabled = false,
}: DiagnosticQuestionCardProps) {
  const stem =
    typeof question.contentJson["stem"] === "string" ? question.contentJson["stem"] : "Question";
  const stemId = `question-${question.assessmentItemId}`;

  return (
    <section
      aria-labelledby={stemId}
      className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_24px_-12px_color-mix(in_srgb,var(--foreground)_28%,transparent)] md:p-8"
    >
      <h2
        id={stemId}
        className="text-xl font-semibold leading-snug tracking-tight text-foreground md:text-2xl"
      >
        {stem}
      </h2>

      <fieldset disabled={disabled} className="mt-6">
        <legend className="sr-only">Answer options</legend>
        <div role="radiogroup" aria-labelledby={stemId} className="space-y-3">
          {question.options.map((option, index) => {
            const label =
              typeof option.optionJson["label"] === "string"
                ? option.optionJson["label"]
                : `Option ${String(option.position)}`;
            const selected = selectedOptionId === option.id;
            const letter = LETTERS[index] ?? String(index + 1);

            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors duration-200 focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2 focus-within:ring-offset-card",
                  selected
                    ? "border-2 border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                    : "border-border hover:border-[var(--ring)]",
                  disabled && "cursor-not-allowed opacity-70",
                )}
              >
                <input
                  type="radio"
                  name={stemId}
                  value={option.id}
                  checked={selected}
                  onChange={() => {
                    onSelectOption(option.id);
                  }}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {letter}
                </span>
                <span
                  className={cn(
                    "text-sm leading-relaxed md:text-base",
                    selected ? "font-medium text-primary" : "text-foreground",
                  )}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
