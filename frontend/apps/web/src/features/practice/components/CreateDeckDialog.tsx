"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { clientApi, toast } from "../../../lib/client-api";

type CreateDeckDialogProps = {
  open: boolean;
  onCancel: () => void;
  onCreated: () => void;
};

/**
 * Creates a learner-owned practice deck. Ownership is assigned server-side from
 * the session, so nothing about the owner is sent from the client.
 */
export function CreateDeckDialog({ open, onCancel, onCreated }: CreateDeckDialogProps) {
  const headingId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
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
    };
  }, [open, saving, onCancel]);

  if (!open) return null;

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await clientApi.post("/api/v1/me/decks", { title: trimmed }, "create-deck");
      toast.success("Deck created.");
      onCreated();
    } catch {
      toast.error("Could not create the deck. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Cancel"
          disabled={saving}
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <h2 id={headingId} className="text-lg font-bold text-foreground">
          New practice deck
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give it a name. Only you can see and practise your own decks.
        </p>

        <label htmlFor={inputId} className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Deck name
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={title}
          maxLength={160}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="e.g. Risk metrics to review"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
        />

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Create deck
          </button>
        </div>
      </div>
    </div>
  );
}
