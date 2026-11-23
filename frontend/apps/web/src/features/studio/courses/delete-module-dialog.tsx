"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { TRASH_RETENTION_DAYS } from "@atlas/contracts/content-trash/content-trash.contract";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { outlineButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";

type DeleteModuleDialogProps = {
  open: boolean;
  moduleId: string | null;
  moduleTitle: string;
  onClose: () => void;
  onDeleted: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Couldn't move the section to Trash. Try again.";
}

export function DeleteModuleDialog({
  open,
  moduleId,
  moduleTitle,
  onClose,
  onDeleted,
}: DeleteModuleDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open || !moduleId) return null;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/modules/${moduleId ?? ""}`, "module-delete", {
        successMessage: "Section moved to Trash",
      });
      onDeleted();
      onClose();
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-module-title"
        className="relative w-full max-w-[440px] overflow-hidden rounded-[20px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex flex-col items-center px-8 pb-2 pt-8 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))]">
            <AlertTriangle className="h-8 w-8 text-[var(--admin-danger)]" aria-hidden="true" />
          </div>
          <h2
            id="delete-module-title"
            className="mb-2 text-lg font-semibold text-[var(--admin-on-surface)]"
          >
            Move this section to Trash?
          </h2>
          <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            <span className="font-medium text-[var(--admin-on-surface)]">{moduleTitle}</span> leaves
            the course. You can restore it from Trash for {TRASH_RETENTION_DAYS} days; after that
            it&apos;s deleted for good. Only an empty section can go to Trash, so move or trash its
            lessons first.
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
            className="flex-1 rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-danger)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98]"
            onClick={() => {
              void confirmDelete();
            }}
            disabled={busy}
          >
            {busy ? "Moving…" : "Move to Trash"}
          </button>
        </div>
      </div>
    </div>
  );
}
