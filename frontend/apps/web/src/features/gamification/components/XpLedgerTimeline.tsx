"use client";

import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

export type LedgerItem = {
  points: number;
  reasonKey: string;
  eventType: string | null;
  occurredAt: string;
};

type XpLedgerTimelineProps = {
  initialItems: LedgerItem[];
  initialCursor: string | null;
};

const REASON_LABELS: Record<string, string> = {
  "lesson.completed": "Completed a lesson",
  "path.step_completed": "Completed a learning path step",
  "assessment.submitted": "Submitted an assessment",
  "assessment.graded.pass": "Passed an assessment",
  "practice.session_completed": "Completed a practice session",
};

function describeLedgerItem(item: LedgerItem): string {
  const known = REASON_LABELS[item.reasonKey];
  if (known) return known;
  if (item.reasonKey.startsWith("streak_bonus.")) {
    return "Streak milestone bonus";
  }
  return item.reasonKey;
}

export function XpLedgerTimeline({ initialItems, initialCursor }: XpLedgerTimelineProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<{
        data: { items: LedgerItem[]; nextCursor: string | null };
      }>(`/api/v1/me/gamification/ledger?limit=10&cursor=${encodeURIComponent(cursor)}`);
      setItems((current) => [...current, ...response.data.items]);
      setCursor(response.data.nextCursor);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Failed to load activity.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Recent XP activity</h2>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No XP earned yet. Complete lessons or practice sessions to get started.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-border">
          {items.map((item, index) => {
            const isPositive = item.points >= 0;
            return (
              <li
                key={`${item.occurredAt}-${String(index)}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{describeLedgerItem(item)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    isPositive
                      ? "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPositive ? `+${String(item.points)}` : String(item.points)} XP
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {error ? (
        <p
          className="mt-3 text-sm text-[color-mix(in_srgb,var(--destructive)_74%,var(--foreground))]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {cursor ? (
        <button
          type="button"
          onClick={() => {
            void loadMore();
          }}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading
            </>
          ) : (
            "Load more"
          )}
        </button>
      ) : null}
    </section>
  );
}
