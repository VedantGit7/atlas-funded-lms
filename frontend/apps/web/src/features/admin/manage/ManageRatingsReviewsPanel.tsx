"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Star, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import {
  managePrimaryButtonClassName,
  manageSearchInputClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

type ManageReviewItem = {
  id: string;
  courseId: string;
  courseTitle: string;
  authorName: string | null;
  authorEmail: string | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
};

type ReviewsListResponse = {
  data: { items: ManageReviewItem[] };
};

type CourseOption = { id: string; title: string };

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const RATING_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({
  value: String(value),
  label: `${String(value)} star${value === 1 ? "" : "s"}`,
}));

function formatError(error: unknown): string {
  return error instanceof ClientApiError ? error.message : "Request failed.";
}

function statusTone(status: ReviewStatus): "success" | "danger" | "neutral" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function authorLabel(item: ManageReviewItem): string {
  return item.authorName ?? item.authorEmail ?? "Unknown";
}

export function ManageRatingsReviewsPanel() {
  const [items, setItems] = useState<ManageReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManageReviewItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManageReviewItem | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      const suffix = params.toString();
      const response = await clientApi.get<ReviewsListResponse>(
        `/api/v1/manage/reviews${suffix ? `?${suffix}` : ""}`,
      );
      setItems(response.data.items);
    } catch (caught) {
      setError(formatError(caught));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadReviews();
    }, 300);
    return () => {
      clearTimeout(handle);
    };
  }, [loadReviews]);

  async function updateStatus(item: ManageReviewItem, status: ReviewStatus) {
    setBusyId(item.id);
    setError(null);
    try {
      const response = await clientApi.patch<{ data: ManageReviewItem }>(
        `/api/v1/manage/reviews/${item.id}`,
        { status },
        `review-status-${item.id}`,
      );
      setItems((previous) =>
        previous.map((row) => (row.id === item.id ? response.data : row)),
      );
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReview(item: ManageReviewItem) {
    setBusyId(item.id);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/manage/reviews/${item.id}`, `review-delete-${item.id}`);
      setDeleteTarget(null);
      setItems((previous) => previous.filter((row) => row.id !== item.id));
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusyId(null);
    }
  }

  const filteredCount = items.length;

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search reviews"
            aria-label="Search reviews"
            className={manageSearchInputClassName}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            ariaLabel="Filter by status"
            className="min-w-[10rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
          />
          <button
            type="button"
            className={managePrimaryButtonClassName}
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add review
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--admin-on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading reviews…
        </div>
      ) : filteredCount === 0 ? (
        <EmptyReviews hasQuery={query.trim().length > 0 || statusFilter.length > 0} />
      ) : (
        <div className={manageTableCardClassName}>
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {filteredCount} {filteredCount === 1 ? "review" : "reviews"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={manageTableHeadClassName}>
                  <th className={manageTableThClassName}>Product</th>
                  <th className={manageTableThClassName}>Author</th>
                  <th className={manageTableThClassName}>Rating</th>
                  <th className={manageTableThClassName}>Comment</th>
                  <th className={manageTableThClassName}>Status</th>
                  <th className={`${manageTableThClassName} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                    <td className={manageTableTdClassName}>
                      <span className="font-semibold">{item.courseTitle}</span>
                    </td>
                    <td className={manageTableTdClassName}>
                      <div className="min-w-0">
                        <p className="font-medium">{authorLabel(item)}</p>
                        {item.authorEmail ? (
                          <p className="text-xs text-[var(--admin-on-surface-variant)]">
                            {item.authorEmail}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className={manageTableTdClassName}>
                      <RatingStars rating={item.rating} />
                    </td>
                    <td className={`${manageTableTdClassName} max-w-xs truncate`}>
                      {item.comment ?? "—"}
                    </td>
                    <td className={manageTableTdClassName}>
                      <span className={manageStatusChipClassName(statusTone(item.status))}>
                        {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className={manageTableTdClassName}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {item.status !== "APPROVED" ? (
                          <ActionButton
                            label="Approve"
                            disabled={busyId === item.id}
                            onClick={() => {
                              void updateStatus(item, "APPROVED");
                            }}
                          />
                        ) : null}
                        {item.status !== "REJECTED" ? (
                          <ActionButton
                            label="Reject"
                            disabled={busyId === item.id}
                            onClick={() => {
                              void updateStatus(item, "REJECTED");
                            }}
                          />
                        ) : null}
                        <ActionButton
                          label="Edit"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setEditTarget(item);
                          }}
                        />
                        <ActionButton
                          label="Delete"
                          tone="danger"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setDeleteTarget(item);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateReviewDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreated={(review) => {
          setCreateOpen(false);
          setItems((previous) => [review, ...previous]);
        }}
      />

      <EditReviewDialog
        item={editTarget}
        busy={busyId === editTarget?.id}
        onClose={() => {
          setEditTarget(null);
        }}
        onSaved={(review) => {
          setEditTarget(null);
          setItems((previous) => previous.map((row) => (row.id === review.id ? review : row)));
        }}
        onError={setError}
        onBusy={setBusyId}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete review?"
        description={
          deleteTarget
            ? `Remove the review from ${authorLabel(deleteTarget)} for ${deleteTarget.courseTitle}.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={busyId !== null}
        onConfirm={() => {
          if (deleteTarget) void deleteReview(deleteTarget);
        }}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${String(rating)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-3.5 w-3.5 ${value <= rating ? "fill-[var(--admin-warning)] text-[var(--admin-warning)]" : "text-[var(--admin-outline)]"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function ActionButton({
  label,
  disabled,
  tone = "default",
  onClick,
}: {
  label: string;
  disabled?: boolean;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))]"
          : "text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyReviews({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-16 text-center">
      <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No reviews found</p>
      <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
        {hasQuery
          ? "Try adjusting your search or status filter."
          : "Learner ratings and reviews will appear here once submitted."}
      </p>
    </div>
  );
}

function ReviewFormDialog({
  open,
  title,
  initialCourseId,
  initialRating,
  initialComment,
  busy,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialCourseId?: string;
  initialRating: number;
  initialComment: string;
  busy: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: { courseId: string; rating: number; comment: string }) => Promise<void>;
}) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseId, setCourseId] = useState(initialCourseId ?? "");
  const [rating, setRating] = useState(String(initialRating));
  const [comment, setComment] = useState(initialComment);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCourseId(initialCourseId ?? "");
    setRating(String(initialRating));
    setComment(initialComment);
    setLocalError(null);
  }, [open, initialCourseId, initialRating, initialComment]);

  useEffect(() => {
    if (!open || initialCourseId) return;
    let cancelled = false;
    setLoadingCourses(true);
    void clientApi
      .get<{ data: { items: CourseOption[] } }>("/api/v1/courses?view=studio&limit=100")
      .then((response) => {
        if (!cancelled) setCourses(response.data.items);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialCourseId]);

  const courseOptions = useMemo(
    () => courses.map((course) => ({ value: course.id, label: course.title })),
    [courses],
  );

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!courseId) {
      setLocalError("Select a course.");
      return;
    }
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      setLocalError("Rating must be between 1 and 5.");
      return;
    }
    setLocalError(null);
    await onSubmit({ courseId, rating: parsedRating, comment: comment.trim() });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 motion-safe:animate-[admin-fade-in_0.15s_ease-out]">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-[var(--admin-scrim)]"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl motion-safe:animate-[admin-slide-up_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {!initialCourseId ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                Course
              </span>
              {loadingCourses ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading courses…</p>
              ) : (
                <Select
                  value={courseId}
                  onValueChange={setCourseId}
                  options={[{ value: "", label: "Select a course" }, ...courseOptions]}
                  ariaLabel="Course"
                  className="w-full border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
                />
              )}
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Rating
            </span>
            <Select
              value={rating}
              onValueChange={setRating}
              options={RATING_OPTIONS}
              ariaLabel="Rating"
              className="w-full border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Comment
            </span>
            <textarea
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
              }}
              rows={4}
              className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              placeholder="Optional review comment"
            />
          </label>

          {localError ? (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {localError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" disabled={busy} onClick={onClose} className={manageSecondaryButtonClassName}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={managePrimaryButtonClassName}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateReviewDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (review: ManageReviewItem) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <ReviewFormDialog
      open={open}
      title="Add review"
      initialRating={5}
      initialComment=""
      busy={busy}
      submitLabel="Create"
      onClose={onClose}
      onSubmit={async (values) => {
        setBusy(true);
        try {
          const response = await clientApi.post<{ data: ManageReviewItem }>(
            "/api/v1/manage/reviews",
            {
              courseId: values.courseId,
              rating: values.rating,
              comment: values.comment || undefined,
              status: "APPROVED",
            },
            "review-create",
          );
          onCreated(response.data);
        } catch (caught) {
          toast.error(formatError(caught));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function EditReviewDialog({
  item,
  busy,
  onClose,
  onSaved,
  onError,
  onBusy,
}: {
  item: ManageReviewItem | null;
  busy: boolean;
  onClose: () => void;
  onSaved: (review: ManageReviewItem) => void;
  onError: (message: string) => void;
  onBusy: (id: string | null) => void;
}) {
  if (!item) {
    return (
      <ReviewFormDialog
        open={false}
        title="Edit review"
        initialRating={5}
        initialComment=""
        busy={false}
        submitLabel="Save"
        onClose={onClose}
        onSubmit={async () => {}}
      />
    );
  }

  return (
    <ReviewFormDialog
      open
      title="Edit review"
      initialCourseId={item.courseId}
      initialRating={item.rating}
      initialComment={item.comment ?? ""}
      busy={busy}
      submitLabel="Save"
      onClose={onClose}
      onSubmit={async (values) => {
        onBusy(item.id);
        onError("");
        try {
          const response = await clientApi.patch<{ data: ManageReviewItem }>(
            `/api/v1/manage/reviews/${item.id}`,
            {
              rating: values.rating,
              comment: values.comment || null,
            },
            `review-edit-${item.id}`,
          );
          onSaved(response.data);
        } catch (caught) {
          onError(formatError(caught));
        } finally {
          onBusy(null);
        }
      }}
    />
  );
}
