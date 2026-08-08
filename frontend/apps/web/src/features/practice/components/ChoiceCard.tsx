"use client";

import { useState } from "react";

type ChoiceOption = { id: string; label: string };

type ChoiceCardProps = {
  options: ChoiceOption[];
  disabled: boolean;
  onSubmit: (selectedOptionId: string) => void;
};

/**
 * Choice card for the learn engine (mcq_single / true_false). The correct answer
 * is never sent to the client: the server grades the submitted option id.
 */
export function ChoiceCard({ options, disabled, onSubmit }: ChoiceCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4" data-testid="choice-card">
      <ul className="space-y-2" role="radiogroup" aria-label="Answer options">
        {options.map((option) => {
          const active = selected === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => {
                  setSelected(option.id);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all disabled:opacity-60 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary"
                }`}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-center">
        <button
          type="button"
          data-testid="choice-submit-button"
          disabled={disabled || !selected}
          onClick={() => {
            if (selected) onSubmit(selected);
          }}
          className="inline-flex min-w-[160px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-95"
        >
          Check answer
        </button>
      </div>
    </div>
  );
}
