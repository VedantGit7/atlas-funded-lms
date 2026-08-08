"use client";

import { useId, useRef, useState } from "react";
import type { StudioLessonTypeCreate } from "@atlas/contracts/lessons/lesson-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import {
  builderHelperClassName,
  primaryButtonClassName,
} from "./course-builder-shared";
import { dialogLabelClassName, fieldClassName } from "./create-course-dialog-shared";
import { LESSON_TITLE_MAX_LENGTH, LESSON_TYPE_OPTIONS } from "./lesson-type-options";

type AddLessonPanelProps = {
  moduleId: string;
  moduleTitle: string;
  onCancel: () => void;
  onLessonCreated: (moduleId: string, lessonId: string) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to create lesson.";
}

export function AddLessonPanel({
  moduleId,
  moduleTitle,
  onCancel,
  onLessonCreated,
}: AddLessonPanelProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [lessonType, setLessonType] = useState<StudioLessonTypeCreate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = title.trim().length > 0 && lessonType !== null && !busy;

  async function handleContinue() {
    if (!canContinue || !lessonType) return;
    setBusy(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: { id: string } }>(
        `/api/v1/modules/${moduleId}/lessons`,
        { title: title.trim(), lessonType },
        "lesson-create",
      );
      onLessonCreated(moduleId, response.data.id);
    } catch (createError) {
      setError(formatError(createError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8 md:px-10 md:py-10 ${inlineExpandClassName}`}
    >
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            {moduleTitle}
          </p>
          <h2 className="mt-1 text-xl font-bold text-[var(--admin-on-surface)] md:text-2xl">
            Add Lesson/Quiz
          </h2>
          <p className={`${builderHelperClassName} mt-2 max-w-xl`}>
            Start creating a lesson or quiz. Select a lesson type and enter a title.
          </p>
        </header>

        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          >
            {error}
          </p>
        ) : null}

        <div className="space-y-8">
          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <label htmlFor={titleId} className={dialogLabelClassName}>
                Lesson Title
              </label>
              <span
                className="text-xs tabular-nums text-[var(--admin-on-surface-variant)]"
                aria-live="polite"
              >
                {title.length}/{LESSON_TITLE_MAX_LENGTH}
              </span>
            </div>
            <input
              ref={titleRef}
              id={titleId}
              className={fieldClassName}
              placeholder="Enter lesson title"
              value={title}
              maxLength={LESSON_TITLE_MAX_LENGTH}
              disabled={busy}
              autoFocus
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancel();
                }
              }}
            />
          </div>

          <fieldset>
            <legend className={`${dialogLabelClassName} mb-4`}>Select Lesson/Quiz Type</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {LESSON_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = lessonType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    onClick={() => {
                      setLessonType(option.id);
                    }}
                    className={[
                      "flex flex-col items-center gap-3 rounded-xl border px-3 py-4 text-center transition-[border-color,box-shadow,background-color,transform] duration-200",
                      "motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                      selected
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--admin-primary)_25%,transparent)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)]",
                    ].join(" ")}
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(${option.accentToken}) 14%, var(--admin-surface))`,
                        color: `var(${option.accentToken})`,
                      }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold leading-tight text-[var(--admin-on-surface)]">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-[var(--admin-border)] pt-6">
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={!canContinue}
            onClick={() => {
              void handleContinue();
            }}
          >
            {busy ? "Creating…" : "Continue"}
          </button>
          <button
            type="button"
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
