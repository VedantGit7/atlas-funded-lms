"use client";

import { useEffect, useId } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onCancel, busy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 motion-safe:animate-[admin-fade-in_0.15s_ease-out]">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-[var(--admin-scrim)]"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl motion-safe:animate-[admin-slide-up_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              destructive
                ? "rounded-lg bg-[var(--admin-danger)] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                : "rounded-lg bg-[var(--admin-on-surface)] px-4 py-2 text-sm font-bold text-[var(--admin-surface)] transition-opacity hover:opacity-90 disabled:opacity-50"
            }
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
