"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { outlineButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";

type DeleteLessonDialogProps = {
  open: boolean;
  lessonId: string;
  courseId: string;
  inline?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Delete failed.";
}

export function DeleteLessonDialog({
  open,
  lessonId,
  courseId,
  inline = false,
  onClose,
  onDeleted,
}: DeleteLessonDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/lessons/${lessonId}`, "lesson-delete");
      onClose();
      if (inline && onDeleted) {
        onDeleted();
        return;
      }
      router.push(`/studio/courses/${courseId}`);
      router.refresh();
    } catch (deleteError) {
      setError(formatError(deleteError));
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
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onClose();
        }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-lesson-title"
        className="relative w-full max-w-[440px] overflow-hidden rounded-[20px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex flex-col items-center px-8 pb-2 pt-8 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]">
            <AlertTriangle className="h-8 w-8 text-[var(--admin-danger)]" aria-hidden="true" />
          </div>
          <h2 id="delete-lesson-title" className="mb-2 text-lg font-semibold text-[var(--admin-on-surface)]">
            Delete this lesson?
          </h2>
          <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            This removes the lesson from the course. Learner progress records are preserved.
          </p>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-4 px-8 pb-8 pt-2">
          <button
            type="button"
            className={`${outlineButtonClassName} flex-1 justify-center py-2.5`}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98]"
            onClick={() => {
              void confirmDelete();
            }}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete lesson"}
          </button>
        </div>

        <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--admin-outline)]">
            Action cannot be undone
          </span>
        </div>
      </div>
    </div>
  );
}
