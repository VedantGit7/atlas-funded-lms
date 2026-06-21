"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  formatModerationError,
  listModerationCases,
  reviewAppeal,
  type ModerationCaseItem,
} from "../api";

export function AppealsReviewClient() {
  const [cases, setCases] = useState<ModerationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAppealId, setBusyAppealId] = useState<string | null>(null);

  const loadAppeals = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listModerationCases({ view: "appeals" });
      setCases(response.data.items);
    } catch (error) {
      setErrorMessage(formatModerationError(error));
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppeals();
  }, [loadAppeals]);

  async function handleReview(
    appealId: string,
    outcome: "uphold" | "reject",
    nextCaseStatus?: "REJECTED" | "CLOSED",
  ) {
    setBusyAppealId(appealId);
    setErrorMessage(null);

    try {
      await reviewAppeal(appealId, {
        outcome,
        ...(outcome === "uphold" && nextCaseStatus ? { nextCaseStatus } : {}),
      });
      await loadAppeals();
    } catch (error) {
      setErrorMessage(formatModerationError(error));
    } finally {
      setBusyAppealId(null);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm opacity-80" aria-live="polite">
          Loading pending appeals…
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && cases.length === 0 ? (
        <p className="text-sm opacity-80">No pending appeals.</p>
      ) : null}

      {!loading && !errorMessage && cases.length > 0 ? (
        <div className="space-y-4">
          {cases.map((item) => {
            const appeal = item.appeals?.find((entry) => entry.status === "open");
            if (!appeal) return null;

            return (
              <article key={item.id} className="rounded border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Appeal for case {item.id.slice(0, 8)}</h2>
                  <Link href={`/moderate/cases/${item.id}`} className="text-sm underline">
                    View case
                  </Link>
                </div>
                <p className="mt-2 text-sm opacity-80">
                  {item.targetType} · {item.target?.previewText ?? "Unavailable"}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm">{appeal.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyAppealId === appeal.id}
                    className="rounded border px-3 py-2 text-sm"
                    onClick={() => {
                      void handleReview(appeal.id, "reject");
                    }}
                  >
                    Reject appeal
                  </button>
                  <button
                    type="button"
                    disabled={busyAppealId === appeal.id}
                    className="rounded border px-3 py-2 text-sm"
                    onClick={() => {
                      void handleReview(appeal.id, "uphold", "REJECTED");
                    }}
                  >
                    Uphold appeal
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
