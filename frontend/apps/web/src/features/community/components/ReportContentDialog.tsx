"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { cn, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  createModerationCase,
  formatModerationError,
  ModerationApiError,
} from "../../moderation/api";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const;

type ReportContentDialogProps = {
  targetType: "post" | "comment";
  targetId: string;
  /** "button" shows a labelled report control, "icon" a compact glyph only. */
  variant?: "button" | "icon";
};

export function ReportContentDialog({
  targetType,
  targetId,
  variant = "button",
}: ReportContentDialogProps) {
  const [open, setOpen] = useState(false);
  const [reasonKey, setReasonKey] = useState<string>(REPORT_REASONS[0].value);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function submitReport() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await createModerationCase({ targetType, targetId, reasonKey });
      setOpen(false);
      setMessage("Report submitted for review.");
    } catch (reportError) {
      setError(formatModerationError(reportError));
      if (reportError instanceof ModerationApiError && reportError.status === 409) {
        setMessage("This content has already been reported.");
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <span ref={containerRef} className="relative inline-flex flex-col">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "button" ? "px-2 py-1" : "p-1",
        )}
        aria-label="Report content"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Flag className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        {variant === "button" ? <span>Report</span> : null}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-full z-20 mt-2 w-64 space-y-3 rounded-xl border border-border bg-card p-3 text-sm shadow-lg",
            dropdownPanelEnterEndClassName,
          )}
          role="dialog"
          aria-label="Report content"
        >
            <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Reason</span>
            <select
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reasonKey}
              onChange={(event) => {
                setReasonKey(event.target.value);
              }}
            >
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={busy}
              onClick={() => void submitReport()}
            >
              {busy ? "Submitting…" : "Submit report"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
      {message ? <p className="mt-1 text-[11px] text-muted-foreground">{message}</p> : null}
    </span>
  );
}
