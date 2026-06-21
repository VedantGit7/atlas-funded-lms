"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAppealSelfReviewBlocked } from "../moderation-self-review";
import {
  formatModerationError,
  listModerationCases,
  reviewAppeal,
  type ModerationCaseItem,
} from "../api";

type PendingReview = {
  appealId: string;
  outcome: "uphold" | "reject";
  nextCaseStatus?: "REJECTED" | "CLOSED";
};

type AppealsReviewClientProps = {
  viewerMembershipId: string;
};

export function AppealsReviewClient({ viewerMembershipId }: AppealsReviewClientProps) {
  const [cases, setCases] = useState<ModerationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAppealId, setBusyAppealId] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (pendingReview) {
      cancelRef.current?.focus();
    }
  }, [pendingReview]);

  async function handleReview(review: PendingReview) {
    setBusyAppealId(review.appealId);
    setErrorMessage(null);

    try {
      await reviewAppeal(review.appealId, {
        outcome: review.outcome,
        ...(review.outcome === "uphold" && review.nextCaseStatus
          ? { nextCaseStatus: review.nextCaseStatus }
          : {}),
      });
      setPendingReview(null);
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

            const selfReviewBlocked = isAppealSelfReviewBlocked({
              viewerMembershipId,
              submittedByMembershipId: appeal.submittedByMembershipId,
            });

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

                {selfReviewBlocked ? (
                  <p className="mt-4 text-sm text-red-700" role="status">
                    You cannot review your own appeal.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyAppealId === appeal.id}
                      className="rounded border px-3 py-2 text-sm"
                      onClick={() => {
                        setPendingReview({ appealId: appeal.id, outcome: "reject" });
                      }}
                    >
                      Reject appeal
                    </button>
                    <button
                      type="button"
                      disabled={busyAppealId === appeal.id}
                      className="rounded border px-3 py-2 text-sm"
                      onClick={() => {
                        setPendingReview({
                          appealId: appeal.id,
                          outcome: "uphold",
                          nextCaseStatus: "REJECTED",
                        });
                      }}
                    >
                      Uphold appeal
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {pendingReview ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appeal-review-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 id="appeal-review-confirm-title" className="font-semibold">
              Confirm appeal review
            </h2>
            <p className="mt-2 text-sm">
              {pendingReview.outcome === "uphold"
                ? "Uphold this appeal and update the related case?"
                : "Reject this appeal?"}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <button
                type="button"
                disabled={busyAppealId === pendingReview.appealId}
                className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
                onClick={() => {
                  void handleReview(pendingReview);
                }}
              >
                Confirm
              </button>
              <button
                ref={cancelRef}
                type="button"
                disabled={busyAppealId === pendingReview.appealId}
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setPendingReview(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
