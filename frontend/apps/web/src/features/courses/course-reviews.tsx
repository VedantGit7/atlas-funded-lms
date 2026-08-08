"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { clientApi, toast } from "../../lib/client-api";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};

type ReviewsResponse = {
  data: {
    items: ReviewItem[];
    aggregate: { average: number | null; count: number };
    myReview: ReviewItem | null;
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
  };
};

type SubmitResponse = { data: { id: string; created: boolean } };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className="h-4 w-4"
          style={{ color: n <= Math.round(value) ? "var(--warning)" : "var(--border)" }}
          fill={n <= Math.round(value) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function CourseReviews({ courseId, canReview }: { courseId: string; canReview: boolean }) {
  const [state, setState] = useState<ReviewsResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await clientApi.get<ReviewsResponse>(`/api/v1/courses/${courseId}/reviews`);
      setState(res.data);
      if (res.data.myReview) {
        setRating(res.data.myReview.rating);
        setComment(res.data.myReview.comment ?? "");
      }
    } catch {
      setState({ items: [], aggregate: { average: null, count: 0 }, myReview: null, pageInfo: { nextCursor: null, hasNextPage: false } });
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      await clientApi.post<SubmitResponse>(
        `/api/v1/courses/${courseId}/reviews`,
        { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) },
        "course-review",
      );
      toast.success("Thanks for your review.");
      await load();
    } catch {
      toast.error("Could not save your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const aggregate = state?.aggregate;
  const hasReviews = (aggregate?.count ?? 0) > 0;

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Ratings &amp; reviews</h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading reviews...
        </div>
      ) : (
        <>
          {/* Aggregate */}
          <div className="flex items-center gap-6 rounded-2xl border border-border bg-card p-6">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-foreground">
                {aggregate?.average != null ? aggregate.average.toFixed(1) : "-"}
              </div>
              <Stars value={aggregate?.average ?? 0} className="mt-1 justify-center" />
              <div className="mt-1 text-xs text-muted-foreground">
                {hasReviews
                  ? `${(aggregate?.count ?? 0).toLocaleString()} ${aggregate?.count === 1 ? "review" : "reviews"}`
                  : "No reviews yet"}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {hasReviews
                ? "What learners say about this course."
                : "Be the first to share how this course helped you."}
            </p>
          </div>

          {/* Submit form (enrolled learners only) */}
          {canReview ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-bold text-foreground">
                {state?.myReview ? "Update your review" : "Write a review"}
              </p>
              <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${String(n)} star${n === 1 ? "" : "s"}`}
                    onMouseEnter={() => {
                      setHover(n);
                    }}
                    onMouseLeave={() => {
                      setHover(0);
                    }}
                    onClick={() => {
                      setRating(n);
                    }}
                    className="p-0.5 transition-transform motion-safe:hover:scale-110"
                  >
                    <Star
                      className="h-7 w-7"
                      style={{ color: n <= (hover || rating) ? "var(--warning)" : "var(--border)" }}
                      fill={n <= (hover || rating) ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                }}
                rows={3}
                maxLength={2000}
                placeholder="Share what worked for you (optional)."
                className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={rating < 1 || submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-95"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {state?.myReview ? "Update review" : "Submit review"}
                </button>
              </div>
            </div>
          ) : null}

          {/* List */}
          {state && state.items.length > 0 ? (
            <ul className="space-y-3">
              {state.items.map((review) => {
                const name = review.authorName?.trim() || "Learner";
                return (
                  <li key={review.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-foreground">{name}</span>
                          {review.mine ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">You</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Stars value={review.rating} />
                          <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {review.comment ? (
                      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{review.comment}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : !canReview ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
