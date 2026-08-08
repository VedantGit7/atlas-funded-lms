"use client";

import { useEffect, useId, useRef } from "react";
import {
  dangerOutlineButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "./certificate-template-admin-shared";

type TemplateConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function TemplateConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onClose,
}: TemplateConfirmDialogProps) {
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="px-6 py-5">
          <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={outlineButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? dangerOutlineButtonClassName : primaryButtonClassName}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
