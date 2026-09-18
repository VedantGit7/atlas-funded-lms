"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { type LucideIcon, X } from "lucide-react";

type ConfirmTone = "primary" | "danger";

type AdminConfirmDialogProps = {
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
  primary: "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]",
  danger: "bg-[var(--admin-danger)]/15 text-[var(--admin-danger)]",
};

const TONE_CONFIRM_BTN: Record<ConfirmTone, string> = {
  primary:
    "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:opacity-90 focus-visible:ring-[var(--admin-primary)]/50",
  danger:
    "bg-[var(--admin-danger)] text-[var(--admin-on-primary)] hover:opacity-90 focus-visible:ring-[var(--admin-danger)]/50",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Admin-themed confirmation modal. Token-driven (works in light and dark),
 * keyboard accessible (Escape to dismiss, Tab confined to the dialog, focus
 * moves to the cancel action on open and restores on close), and
 * motion-respectful.
 */
export function AdminConfirmDialog({
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
}: AdminConfirmDialogProps) {
  const headingId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Opening effect: depends only on `open`. It used to depend on `busy` too, so
  // every save re-ran it — re-snapshotting `previouslyFocused` from inside the
  // dialog (losing the element to restore to) and yanking focus back to Cancel
  // mid-action.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Key handling reads `busy`, so it is its own effect and re-binds cheaply.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }

      // Confine Tab to the dialog. `aria-modal` already tells a screen reader
      // the rest of the page is inert; without this the keyboard disagreed and
      // Tab walked out into the frozen page behind the scrim.
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dismiss-on-click surface, deliberately not a button: as one it
          announced a full-screen "Cancel" control ahead of the dialog's own
          content. The X and the Cancel button are the accessible routes out. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />

      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          aria-label={cancelLabel}
          disabled={busy}
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
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

        <h2 id={headingId} className="text-lg font-bold text-[var(--admin-on-surface)]">
          {title}
        </h2>
        {/* A div, not a p: callers pass block-level content (lists, stacked
            paragraphs), and nesting those inside a p is invalid HTML that the
            browser silently reparses, breaking hydration. */}
        <div
          id={descriptionId}
          className="mt-2 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]"
        >
          {description}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]"
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
            className="inline-flex items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50"
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
