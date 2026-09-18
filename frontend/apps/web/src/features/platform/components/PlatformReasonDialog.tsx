"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { platformReasonSchema } from "../platform-reason-schema";
import { usePlatformReason } from "./PlatformReasonProvider";

type PlatformReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PlatformReasonDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  value,
  onChange,
  onConfirm,
  onCancel,
}: PlatformReasonDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const validation = platformReasonSchema.safeParse(value);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-reason-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg">
        <h2 id="platform-reason-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Operational reason</span>
          <textarea
            className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
            rows={4}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            aria-invalid={!validation.success}
          />
        </label>
        {!validation.success ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Reason must be at least 10 characters.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="rounded border border-border px-3 py-2 text-sm hover:bg-muted"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            disabled={!validation.success}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type PlatformReasonGateProps = {
  children: ReactNode;
  ready: boolean;
};

export function PlatformReasonGate({ children, ready }: PlatformReasonGateProps) {
  const { promptForReason } = usePlatformReason();

  if (!ready) {
    return (
      <section className="rounded border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-semibold">Reason required</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Platform console reads and actions require an operational reason of at least 10 characters
          for this session context.
        </p>
        <button
          type="button"
          className="mt-4 rounded border border-border px-3 py-2 text-sm hover:bg-muted"
          onClick={promptForReason}
        >
          Provide reason
        </button>
      </section>
    );
  }

  return <>{children}</>;
}
