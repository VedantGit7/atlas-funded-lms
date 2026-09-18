"use client";

import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";

type MatchOption = { id: string; label: string };

type MatchCardProps = {
  leftItems: MatchOption[];
  rightItems: MatchOption[];
  disabled: boolean;
  onSubmit: (pairs: Record<string, string>) => void;
};

/**
 * Matching practice card. The learner selects a left item then its partner on
 * the right. Grading happens on the server: this component never receives the
 * correct pairing.
 */
export function MatchCard({ leftItems, rightItems, disabled, onSubmit }: MatchCardProps) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  const pairedRightIds = useMemo(() => new Set(Object.values(pairs)), [pairs]);
  const complete = Object.keys(pairs).length === leftItems.length && leftItems.length > 0;

  function selectLeft(id: string) {
    if (disabled) return;
    setActiveLeft((current) => (current === id ? null : id));
  }

  function selectRight(rightId: string) {
    if (disabled) return;
    // Tapping a paired right item unpairs it.
    const existingLeft = Object.keys(pairs).find((leftId) => pairs[leftId] === rightId);
    if (existingLeft) {
      setPairs((current) =>
        Object.fromEntries(Object.entries(current).filter(([leftId]) => leftId !== existingLeft)),
      );
      return;
    }
    if (!activeLeft) return;
    setPairs((current) => ({ ...current, [activeLeft]: rightId }));
    setActiveLeft(null);
  }

  function reset() {
    setPairs({});
    setActiveLeft(null);
  }

  const rightLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of rightItems) map.set(option.id, option.label);
    return map;
  }, [rightItems]);

  return (
    <div className="space-y-4" data-testid="match-card">
      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <ul className="space-y-2">
          {leftItems.map((option) => {
            const pairedWith = pairs[option.id];
            const isActive = activeLeft === option.id;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={isActive}
                  onClick={() => {
                    selectLeft(option.id);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all disabled:opacity-60 ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : pairedWith
                        ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-foreground"
                        : "border-border bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {option.label}
                  {pairedWith ? (
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">
                      {rightLabelById.get(pairedWith) ?? pairedWith}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Right column */}
        <ul className="space-y-2">
          {rightItems.map((option) => {
            const used = pairedRightIds.has(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={disabled || (!activeLeft && !used)}
                  onClick={() => {
                    selectRight(option.id);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all disabled:opacity-50 ${
                    used
                      ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-foreground"
                      : "border-border bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={disabled || Object.keys(pairs).length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </button>
        <button
          type="button"
          data-testid="match-submit-button"
          disabled={disabled || !complete}
          onClick={() => {
            onSubmit(pairs);
          }}
          className="inline-flex min-w-[160px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-95"
        >
          {complete
            ? "Check answers"
            : `${String(Object.keys(pairs).length)} / ${String(leftItems.length)} matched`}
        </button>
      </div>
    </div>
  );
}
