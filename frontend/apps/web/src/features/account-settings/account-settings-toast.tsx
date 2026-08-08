"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useAccountTheme } from "./account-theme-context";

type AccountSettingsToastProps = {
  message: string;
  open: boolean;
  onClose: () => void;
  durationMs?: number;
};

export function AccountSettingsToast({
  message,
  open,
  onClose,
  durationMs = 4000,
}: AccountSettingsToastProps) {
  const { classes } = useAccountTheme();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, onClose, durationMs]);

  if (!open) return null;

  return (
    <div className={classes.toast} role="status" aria-live="polite">
      <CheckCircle2 className="h-5 w-5 text-[var(--acct-inverse-primary)]" aria-hidden="true" />
      <span className="text-sm">{message}</span>
      <button
        type="button"
        className="ml-1 rounded-full p-1 transition-colors hover:bg-[color-mix(in_srgb,var(--acct-inverse-on-surface)_10%,transparent)]"
        aria-label="Dismiss notification"
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
