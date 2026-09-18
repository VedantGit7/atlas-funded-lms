"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, History, Loader2, RefreshCw, Scale, TriangleAlert } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { formatRelativeUpdatedAt } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  alertErrorClassName,
  appealCardClassName,
  appealCardConflictAccentClassName,
  appealConflictBannerClassName,
  appealEvidenceBlockClassName,
  appealSectionEyebrowClassName,
  appealStatementEyebrowClassName,
  formatCaseRef,
  formatOriginalDecisionSummary,
  moderationPageDescClassName,
  moderationPageTitleClassName,
  monoClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  targetTypeMeta,
} from "../moderation-admin-shared";
import { adminModerationCaseDetailPath } from "../moderation-paths";
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

type AppealCardProps = {
  item: ModerationCaseItem;
  appeal: NonNullable<ModerationCaseItem["appeals"]>[number];
  viewerMembershipId: string;
  busyAppealId: string | null;
  onReject: (appealId: string) => void;
  onUphold: (appealId: string) => void;
};

function AppealReviewCard({
  item,
  appeal,
  viewerMembershipId,
  busyAppealId,
  onReject,
  onUphold,
}: AppealCardProps) {
  const selfReviewBlocked = isAppealSelfReviewBlocked({
    viewerMembershipId,
    submittedByMembershipId: appeal.submittedByMembershipId,
  });
  const target = targetTypeMeta(item.targetType);
  const receivedLabel = formatRelativeUpdatedAt(item.createdAt);

  return (
    <article
      className={`relative ${appealCardClassName} ${selfReviewBlocked ? "opacity-95" : ""}`}
      aria-labelledby={`appeal-${appeal.id}-title`}
    >
      {selfReviewBlocked ? (
        <span className={appealCardConflictAccentClassName} aria-hidden="true" />
      ) : null}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-[var(--admin-primary-container)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-primary-container)]">
            {target.label}
          </span>
          <code className={`${monoClassName} text-[var(--admin-on-surface-variant)]`}>
            {formatCaseRef(item.id)}
          </code>
        </div>
        <span className="text-xs text-[var(--admin-on-surface-variant)]">
          Received {receivedLabel}
        </span>
      </div>

      <div className="mb-4">
        <p className={appealSectionEyebrowClassName}>Evidence block</p>
        <div className={appealEvidenceBlockClassName}>
          {item.target?.previewText
            ? `"${item.target.previewText}"`
            : "Original content preview is unavailable."}
        </div>
      </div>

      <div className="mb-4">
        <p className={appealStatementEyebrowClassName}>Appellant&apos;s statement</p>
        <p
          id={`appeal-${appeal.id}-title`}
          className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-on-surface)]"
        >
          {appeal.body}
        </p>
      </div>

      {selfReviewBlocked ? (
        <div className={`${appealConflictBannerClassName} mb-4`} role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>You cannot review your own appeal. Assign this review to another moderator.</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)]">
            <History className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Original decision: {formatOriginalDecisionSummary(item)}</span>
          </div>
          <Link
            href={adminModerationCaseDetailPath(item.id)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--admin-primary)] transition-colors hover:underline"
          >
            View original case
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {selfReviewBlocked ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[var(--admin-border)] px-4 py-2 text-[13px] font-medium text-[var(--admin-on-surface-variant)]"
          >
            Review unavailable
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyAppealId === appeal.id}
              className={outlineButtonClassName}
              onClick={() => {
                onReject(appeal.id);
              }}
            >
              Reject appeal
            </button>
            <button
              type="button"
              disabled={busyAppealId === appeal.id}
              className={primaryButtonClassName}
              onClick={() => {
                onUphold(appeal.id);
              }}
            >
              Uphold appeal
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function AppealsReviewClient({ viewerMembershipId }: AppealsReviewClientProps) {
  const [cases, setCases] = useState<ModerationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAppealId, setBusyAppealId] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);

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

  const openAppeals = useMemo(
    () =>
      cases.flatMap((item) => {
        const appeal = item.appeals?.find((entry) => entry.status === "open");
        return appeal ? [{ item, appeal }] : [];
      }),
    [cases],
  );

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
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
            <h1 className={moderationPageTitleClassName}>Appeals review</h1>
          </div>
          <p className={moderationPageDescClassName}>
            {loading
              ? "Loading open appeals…"
              : `${openAppeals.length} open ${openAppeals.length === 1 ? "appeal" : "appeals"} requiring institutional oversight`}
          </p>
        </div>
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={loading}
          onClick={() => {
            void loadAppeals();
          }}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh queue
        </button>
      </header>

      {loading ? (
        <p
          className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          Loading pending appeals…
        </p>
      ) : null}

      {errorMessage ? (
        <p className={alertErrorClassName} role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && openAppeals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-12 text-center">
          <Scale className="mx-auto h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[var(--admin-on-surface)]">
            No pending appeals
          </p>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            New member appeals against moderation decisions will appear here.
          </p>
        </div>
      ) : null}

      {!loading && !errorMessage && openAppeals.length > 0 ? (
        <>
          <div className="space-y-4">
            {openAppeals.map(({ item, appeal }) => (
              <AppealReviewCard
                key={appeal.id}
                item={item}
                appeal={appeal}
                viewerMembershipId={viewerMembershipId}
                busyAppealId={busyAppealId}
                onReject={(appealId) => {
                  setPendingReview({ appealId, outcome: "reject" });
                }}
                onUphold={(appealId) => {
                  setPendingReview({
                    appealId,
                    outcome: "uphold",
                    nextCaseStatus: "REJECTED",
                  });
                }}
              />
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-5 text-[13px] text-[var(--admin-on-surface-variant)]">
            <span>
              Showing {openAppeals.length} open {openAppeals.length === 1 ? "appeal" : "appeals"}
            </span>
          </footer>
        </>
      ) : null}

      <AdminConfirmDialog
        open={pendingReview != null}
        title="Confirm appeal review"
        description={
          pendingReview?.outcome === "uphold"
            ? "Uphold this appeal and update the related moderation case?"
            : "Reject this appeal and keep the original moderation outcome?"
        }
        confirmLabel="Confirm"
        busyLabel="Saving…"
        tone="primary"
        busy={busyAppealId != null}
        error={errorMessage}
        onConfirm={() => {
          if (pendingReview) {
            void handleReview(pendingReview);
          }
        }}
        onCancel={() => {
          if (!busyAppealId) {
            setPendingReview(null);
          }
        }}
      />
    </div>
  );
}
