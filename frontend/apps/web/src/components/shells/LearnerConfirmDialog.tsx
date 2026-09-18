"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { type LucideIcon, X } from "lucide-react";

type ConfirmTone = "primary" | "danger";

type LearnerConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Confirm-button label while the action runs. Defaults to confirmLabel. */
  busyLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  tone?: ConfirmTone;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const TONE_BADGE: Record<ConfirmTone, string> = {
  primary: "bg-primary/15 text-primary",
  danger: "bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] text-[var(--destructive)]",
};

const TONE_CONFIRM_BTN: Record<ConfirmTone, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-primary/50",
  danger:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 focus-visible:ring-[var(--destructive)]/50",
};

/**
 * Learner-themed confirmation modal. Mirrors AdminConfirmDialog's behaviour but
 * uses learner design tokens. Token-driven (light and dark), keyboard accessible
 * (Escape dismisses, focus moves to cancel on open and restores on close), and
 * motion-respectful.
 */
export function LearnerConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  icon: Icon,
  tone = "primary",
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: LearnerConfirmDialogProps) {
  const headingId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          aria-label={cancelLabel}
          disabled={busy}
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        {Icon ? (
          <span
            className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full ${TONE_BADGE[tone]}`}
          >
            <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
        ) : null}

        <h2 id={headingId} className="text-lg font-bold text-foreground">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity focus:outline-none focus-visible:ring-2 disabled:opacity-70 ${TONE_CONFIRM_BTN[tone]}`}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
