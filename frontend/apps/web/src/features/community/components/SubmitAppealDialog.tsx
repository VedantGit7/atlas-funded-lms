"use client";

import { useState } from "react";
import { createAppeal, formatModerationError } from "../../moderation/api";

type SubmitAppealDialogProps = {
  moderationCaseId: string;
};

export function SubmitAppealDialog({ moderationCaseId }: SubmitAppealDialogProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitAppeal() {
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Explain why this moderation decision should be reviewed.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await createAppeal({ moderationCaseId, body: trimmed });
      setOpen(false);
      setBody("");
      setMessage("Appeal submitted for review.");
    } catch (appealError) {
      setError(formatModerationError(appealError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <h2 className="font-semibold text-foreground">Moderation action on your content</h2>
      <p className="mt-1 text-muted-foreground">
        You can submit one appeal for moderators to review.
      </p>
      {message ? <p className="mt-2 text-foreground">{message}</p> : null}
      {!message && !open ? (
        <button
          type="button"
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setOpen(true);
          }}
        >
          Submit appeal
        </button>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-3">
          <label className="block space-y-1">
            <span className="font-medium text-foreground">Appeal details</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-input bg-background p-2 text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              placeholder="Describe why this content should be restored or the decision reconsidered."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={busy}
              onClick={() => void submitAppeal()}
            >
              {busy ? "Submitting…" : "Send appeal"}
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
