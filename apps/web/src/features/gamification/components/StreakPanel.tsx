"use client";

import { useState } from "react";
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
    <section className="rounded border p-4">
      <h2 className="font-semibold">Daily learning streak</h2>
      <p className="mt-1 text-sm opacity-80">
        Current: {current} · Longest: {longestCount}
        {lastDate ? ` · Last activity: ${lastDate}` : null}
      </p>
      <p className="mt-1 text-sm">Available freezes: {availableFreezes}</p>

      {availableFreezes > 0 ? (
        <button
          type="button"
          className="mt-3 rounded border px-3 py-1 text-sm"
          onClick={() => {
            setConfirmOpen(true);
          }}
          disabled={pending}
        >
          Use streak freeze
        </button>
      ) : null}

      {confirmOpen ? (
        <div className="mt-3 rounded border p-3 text-sm" role="dialog" aria-label="Confirm freeze">
          <p>Use one streak freeze to protect yesterday&apos;s missed day?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => {
                void handleFreeze();
              }}
              disabled={pending}
            >
              {pending ? "Applying…" : "Confirm freeze"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}
    </section>
  );
}
