"use client";

import { useState } from "react";
import { AlertCircle, Flame, Loader2, Snowflake } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type StreakPanelProps = {
  streakKey: string;
  currentCount: number;
  longestCount: number;
  lastActivityDate: string | null;
  availableFreezes: number;
};

export function StreakPanel({
  streakKey,
  currentCount,
  longestCount,
  lastActivityDate,
  availableFreezes: initialFreezes,
}: StreakPanelProps) {
  const [availableFreezes, setAvailableFreezes] = useState(initialFreezes);
  const [current, setCurrent] = useState(currentCount);
  const [lastDate, setLastDate] = useState(lastActivityDate);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function handleFreeze() {
    setPending(true);
    setError(null);
    setRequestId(null);

    try {
      const response = await clientApi.post<{
        data: {
          currentCount: number;
          lastActivityDate: string | null;
          availableFreezes: number;
        };
      }>(`/api/v1/me/streaks/${encodeURIComponent(streakKey)}/freeze`, {}, "streak-freeze");

      setCurrent(response.data.currentCount);
      setLastDate(response.data.lastActivityDate);
      setAvailableFreezes(response.data.availableFreezes);
      setConfirmOpen(false);
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Unable to apply streak freeze.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[color-mix(in_srgb,var(--destructive)_72%,var(--foreground))]">
            <Flame className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Streak protection</h2>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              Current {current} · Longest {longestCount}
              {lastDate ? ` · Last active ${lastDate}` : ""}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
          <Snowflake className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {availableFreezes} {availableFreezes === 1 ? "freeze" : "freezes"}
        </span>
      </div>

      {availableFreezes > 0 ? (
        <button
          type="button"
          onClick={() => {
            setConfirmOpen(true);
          }}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <Snowflake className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Use streak freeze
        </button>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          No freezes available. Earn more by keeping your streak going.
        </p>
      )}

      {confirmOpen ? (
        <div
          className="mt-4 rounded-xl border border-border bg-muted/50 p-3 text-sm"
          role="dialog"
          aria-label="Confirm streak freeze"
        >
          <p className="text-foreground">
            Use one streak freeze to protect yesterday&apos;s missed day?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void handleFreeze();
              }}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Applying
                </>
              ) : (
                "Confirm freeze"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
              }}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-3 flex items-start gap-2 text-sm text-[color-mix(in_srgb,var(--destructive)_74%,var(--foreground))]"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            {error}
            {requestId ? ` (Request ID: ${requestId})` : null}
          </span>
        </p>
      ) : null}
    </section>
  );
}
