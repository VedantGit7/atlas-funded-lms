"use client";

import { useEffect, useId, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { outlineButtonClassName } from "./course-builder-shared";
import { dialogLabelClassName, fieldClassName } from "./create-course-dialog-shared";

type SectionOption = {
  id: string;
  title: string;
};

type MoveLessonSectionDialogProps = {
  open: boolean;
  lessonTitle: string;
  currentModuleId: string;
  sections: SectionOption[];
  onClose: () => void;
  onMoved: (targetModuleId: string) => void;
  lessonId: string | null;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to move lesson.";
}

export function MoveLessonSectionDialog({
  open,
  lessonTitle,
  currentModuleId,
  sections,
  onClose,
  onMoved,
  lessonId,
}: MoveLessonSectionDialogProps) {
  const selectId = useId();
  const [targetModuleId, setTargetModuleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSections = sections.filter((section) => section.id !== currentModuleId);

  useEffect(() => {
    if (!open) {
      setTargetModuleId("");
      setError(null);
      return;
    }

    const destinations = sections.filter((section) => section.id !== currentModuleId);
    setTargetModuleId(destinations[0]?.id ?? "");

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onClose, sections, currentModuleId]);

  if (!open || !lessonId) return null;

  async function confirmMove() {
    if (!targetModuleId) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi.put(
        `/api/v1/lessons/${lessonId}`,
        { moduleId: targetModuleId },
        "lesson-move-section",
      );
      onMoved(targetModuleId);
      onClose();
    } catch (moveError) {
      setError(formatError(moveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-theme fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-lesson-section-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="border-b border-[var(--admin-border)] px-6 py-5">
          <h2
            id="move-lesson-section-title"
            className="text-lg font-semibold text-[var(--admin-on-surface)]"
          >
            Move to another section
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Move &ldquo;{lessonTitle}&rdquo; to a different chapter.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error ? (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}

          {availableSections.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No other sections are available in this course.
            </p>
          ) : (
            <div>
              <label htmlFor={selectId} className={dialogLabelClassName}>
                Destination section
              </label>
              <select
                id={selectId}
                className={fieldClassName}
                value={targetModuleId}
                disabled={busy}
                onChange={(event) => {
                  setTargetModuleId(event.target.value);
                }}
              >
                {availableSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={outlineButtonClassName}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={busy || !targetModuleId || availableSections.length === 0}
            onClick={() => {
              void confirmMove();
            }}
          >
            {busy ? "Moving…" : "Move lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}
