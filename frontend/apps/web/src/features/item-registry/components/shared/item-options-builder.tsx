"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { editorHintClassName, editorInputClassName, editorLabelClassName } from "./editor-styles";

export type EditorOptionRow = {
  id: string;
  label: string;
  isCorrect: boolean;
  position: number;
};

type ItemOptionsBuilderProps = {
  options: EditorOptionRow[];
  onChange: (options: EditorOptionRow[]) => void;
  mode: "single" | "multi";
  disabled?: boolean;
};

function createOptionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `opt-${String(Date.now())}-${String(Math.random()).slice(2, 8)}-${String(Math.random()).slice(2, 8)}`;
}

export function defaultEditorOptions(count = 4): EditorOptionRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `opt-default-${String(index)}`,
    label: "",
    isCorrect: index === 0,
    position: index + 1,
  }));
}

export function ItemOptionsBuilder({
  options,
  onChange,
  mode,
  disabled = false,
}: ItemOptionsBuilderProps) {
  function updateOption(id: string, patch: Partial<EditorOptionRow>) {
    onChange(options.map((option) => (option.id === id ? { ...option, ...patch } : option)));
  }

  function addOption() {
    onChange([
      ...options,
      {
        id: createOptionId(),
        label: "",
        isCorrect: false,
        position: options.length + 1,
      },
    ]);
  }

  function removeOption(id: string) {
    onChange(
      options
        .filter((option) => option.id !== id)
        .map((option, index) => ({ ...option, position: index + 1 })),
    );
  }

  function setCorrect(id: string) {
    if (mode === "single") {
      onChange(
        options.map((option) => ({
          ...option,
          isCorrect: option.id === id,
        })),
      );
      return;
    }

    onChange(
      options.map((option) =>
        option.id === id ? { ...option, isCorrect: !option.isCorrect } : option,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <span className={editorLabelClassName}>Answer options</span>
        <p className={editorHintClassName}>
          {mode === "single"
            ? "Add choices and mark exactly one as correct."
            : "Add choices and mark all correct answers."}
        </p>
      </div>

      <ul className="space-y-2">
        {options.map((option, index) => (
          <li
            key={option.id}
            className="group flex items-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200 hover:border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))]"
            style={{ animationDelay: `${String(index * 40)}ms` }}
          >
            <GripVertical
              className="mt-2.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] opacity-50"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                type="text"
                disabled={disabled}
                value={option.label}
                onChange={(event) => {
                  updateOption(option.id, { label: event.target.value });
                }}
                placeholder={`Option ${String(option.position)}`}
                className={editorInputClassName}
                aria-label={`Option ${String(option.position)} label`}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setCorrect(option.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors duration-200 ${
                  option.isCorrect
                    ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))]"
                }`}
              >
                {mode === "single"
                  ? option.isCorrect
                    ? "Correct"
                    : "Set correct"
                  : option.isCorrect
                    ? "Correct ✓"
                    : "Mark correct"}
              </button>
            </div>
            <button
              type="button"
              disabled={disabled || options.length <= 2}
              aria-label={`Remove option ${String(option.position)}`}
              onClick={() => {
                removeOption(option.id);
              }}
              className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] hover:text-[var(--admin-danger)] disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={disabled || options.length >= 8}
        onClick={addOption}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--admin-border)] px-3 py-2 text-sm font-medium text-[var(--admin-primary)] transition-colors hover:border-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary-container)_20%,var(--admin-surface))] motion-safe:active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add option
      </button>
    </div>
  );
}

export function editorOptionsFromSaved(
  saved?: Array<{
    id: string;
    optionJson?: unknown;
    isCorrect: boolean | null;
    position: number;
  }>,
): EditorOptionRow[] {
  if (!saved || saved.length === 0) {
    return defaultEditorOptions();
  }

  return [...saved]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({
      id: option.id,
      label:
        typeof option.optionJson === "object" &&
        option.optionJson !== null &&
        "label" in option.optionJson &&
        typeof (option.optionJson as { label?: unknown }).label === "string"
          ? (option.optionJson as { label: string }).label
          : "",
      isCorrect: option.isCorrect === true,
      position: option.position,
    }));
}

export function editorOptionsToPayload(options: EditorOptionRow[]) {
  return options
    .filter((option) => option.label.trim().length > 0)
    .map((option) => ({
      optionJson: { label: option.label.trim() },
      isCorrect: option.isCorrect,
      position: option.position,
    }));
}

export function answerKeyFromOptions(
  options: EditorOptionRow[],
  mode: "single" | "multi",
): Record<string, unknown> {
  if (mode === "single") {
    const correct = options.find((option) => option.isCorrect);
    return correct ? { correctOptionId: correct.id } : {};
  }

  return {
    correctOptionIds: options.filter((option) => option.isCorrect).map((option) => option.id),
  };
}
