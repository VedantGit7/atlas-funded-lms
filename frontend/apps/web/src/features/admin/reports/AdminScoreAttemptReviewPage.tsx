"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  Lock,
  Mail,
  Minus,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
  User,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchScoreAttemptReview,
  grantExtraScoreAttempt,
  resetScoreAttempt,
  saveAttemptGrading,
  sendScoreMessage,
  voidScoreAttempt,
  type ScoreAttemptReviewData,
  type ScoreQuestionOutcome,
} from "./admin-progress-score-roster-api";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";

type GradeDraft = {
  pointsAwarded: string;
  feedback: string;
};

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function formatSubmitted(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultPillClass(status: string): string {
  if (status === "pass") {
    return "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]";
  }
  if (status === "fail" || status === "voided") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "pending") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function outcomeMeta(outcome: ScoreQuestionOutcome): {
  label: string;
  className: string;
  rail: string;
  Icon: typeof CheckCircle2;
} {
  if (outcome === "correct") {
    return {
      label: "Correct",
      className: "text-[var(--admin-primary)]",
      rail: "bg-[var(--admin-primary)]",
      Icon: CheckCircle2,
    };
  }
  if (outcome === "incorrect") {
    return {
      label: "Incorrect",
      className: "text-[var(--admin-danger)]",
      rail: "bg-[var(--admin-danger)]",
      Icon: XCircle,
    };
  }
  if (outcome === "needs_grading") {
    return {
      label: "Needs grading",
      className: "text-[var(--admin-warning)]",
      rail: "bg-[var(--admin-warning)]",
      Icon: AlertTriangle,
    };
  }
  return {
    label: "Unanswered",
    className: "text-[var(--admin-warning)]",
    rail: "bg-[var(--admin-warning)]",
    Icon: Minus,
  };
}

function severityClass(severity: string): string {
  if (severity === "high") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (severity === "medium") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  if (severity === "low") {
    return "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]";
  }
  return "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]";
}

function ReviewSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Loading attempt review"
    >
      <div className="flex flex-col gap-8 lg:col-span-8">
        <div className="space-y-3">
          <Shimmer className="h-3 w-48" />
          <Shimmer className="h-10 w-3/4 max-w-xl" />
          <Shimmer className="h-4 w-1/2" />
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-8 w-20" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6"
          >
            <Shimmer className="mb-4 h-5 w-2/3" />
            <Shimmer className="mb-2 h-10 w-full" />
            <Shimmer className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-6 lg:col-span-4">
        <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="mb-4 h-5 w-32" />
          <Shimmer className="mb-3 h-12 w-full" />
          <Shimmer className="h-12 w-full" />
        </div>
        <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="mb-4 h-5 w-40" />
          <Shimmer className="mb-3 h-16 w-full" />
          <Shimmer className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

function VoidModal({
  open,
  learnerName,
  attemptLabel,
  scorePct,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  learnerName: string;
  attemptLabel: string;
  scorePct: number | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const titleId = useId();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_70%,transparent)] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-[540px] flex-col gap-6 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          className="absolute right-6 top-6 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex flex-col gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_15%,transparent)]">
            <AlertTriangle className="h-6 w-6 text-[var(--admin-warning)]" aria-hidden="true" />
          </div>
          <h2
            id={titleId}
            className="text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]"
          >
            Void Attempt
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          You are about to void{" "}
          <strong className="text-[var(--admin-on-surface)]">
            {attemptLabel} ({formatPct(scorePct)})
          </strong>{" "}
          for {learnerName}. This attempt will be excluded from all performance reports and rosters
          but will be retained in the audit log.
        </p>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="void-reason"
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface)]"
          >
            Reason for voiding
          </label>
          <textarea
            id="void-reason"
            rows={4}
            required
            className="resize-none rounded-sm border border-[var(--admin-on-surface)] bg-[var(--admin-surface-low)] p-4 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-warning)] focus:ring-1 focus:ring-[var(--admin-warning)]"
            placeholder="Provide a required explanation for the audit log…"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] pt-4">
          <button
            type="button"
            className={`${ghostButtonClassName} border-2 border-[var(--admin-on-surface)]`}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm bg-[var(--admin-warning)] px-6 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-warning)] hover:brightness-110 disabled:opacity-50"
            disabled={busy || !reason.trim()}
            onClick={() => {
              onConfirm(reason.trim());
            }}
          >
            Void Attempt
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Screen 8 — Attempt Review.
 * Reading this as: admin LMS operator console for single-attempt grading & integrity.
 */
export function AdminScoreAttemptReviewPage({
  assessmentId,
  attemptId,
}: {
  assessmentId: string;
  attemptId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ScoreAttemptReviewData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, GradeDraft>>({});
  const [voidOpen, setVoidOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchScoreAttemptReview(assessmentId, attemptId);
      setData(response.data);
      const nextDrafts: Record<string, GradeDraft> = {};
      for (const question of response.data.questions) {
        if (question.isManual) {
          nextDrafts[question.assessmentItemId] = {
            pointsAwarded: question.pointsAwarded == null ? "" : String(question.pointsAwarded),
            feedback: question.feedback ?? "",
          };
        }
      }
      setDrafts(nextDrafts);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load attempt review.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, attemptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyItems = useMemo(() => {
    if (!data) return [];
    const items: Array<{ assessmentItemId: string; pointsAwarded: number; feedback?: string }> = [];
    for (const question of data.questions) {
      if (!question.isManual) continue;
      const draft = drafts[question.assessmentItemId];
      if (!draft) continue;
      const points = Number(draft.pointsAwarded);
      if (!Number.isFinite(points)) continue;
      const feedbackChanged = (draft.feedback || "") !== (question.feedback ?? "");
      const pointsChanged =
        question.pointsAwarded == null || Math.abs(question.pointsAwarded - points) > 0.001;
      if (pointsChanged || feedbackChanged) {
        items.push({
          assessmentItemId: question.assessmentItemId,
          pointsAwarded: points,
          ...(draft.feedback.trim() ? { feedback: draft.feedback.trim() } : {}),
        });
      }
    }
    return items;
  }, [data, drafts]);

  const previewScore = useMemo(() => {
    if (!data) return null;
    let earned = 0;
    let possible = 0;
    for (const question of data.questions) {
      possible += question.pointsMax;
      const draft = drafts[question.assessmentItemId];
      if (question.isManual && draft && Number.isFinite(Number(draft.pointsAwarded))) {
        earned += Number(draft.pointsAwarded);
      } else {
        earned += question.pointsAwarded ?? 0;
      }
    }
    if (possible <= 0) return null;
    return Math.round((earned / possible) * 1000) / 10;
  }, [data, drafts]);

  const previewResult =
    previewScore != null && data?.assessment.passMarkPercent != null
      ? previewScore >= data.assessment.passMarkPercent
        ? "pass"
        : "fail"
      : (data?.attempt.resultStatus ?? "pending");

  async function handleSave() {
    if (dirtyItems.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await saveAttemptGrading(assessmentId, attemptId, { items: dirtyItems });
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof ClientApiError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : "Unable to save grading.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid(reason: string) {
    setBusy(true);
    setError(null);
    try {
      await voidScoreAttempt(assessmentId, attemptId, { reason });
      setVoidOpen(false);
      router.push(`/admin/reports/progress-score/scores/quizzes/${assessmentId}`);
    } catch (voidError) {
      setError(
        voidError instanceof ClientApiError
          ? voidError.message
          : voidError instanceof Error
            ? voidError.message
            : "Unable to void attempt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      await resetScoreAttempt(assessmentId, attemptId, {
        reason: "Reset by administrator",
      });
      router.push(`/admin/reports/progress-score/scores/quizzes/${assessmentId}`);
    } catch (resetError) {
      setError(
        resetError instanceof ClientApiError
          ? resetError.message
          : resetError instanceof Error
            ? resetError.message
            : "Unable to reset attempt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGrant() {
    setBusy(true);
    setError(null);
    try {
      await grantExtraScoreAttempt(assessmentId, attemptId, { count: 1 });
      await load();
    } catch (grantError) {
      setError(
        grantError instanceof ClientApiError
          ? grantError.message
          : grantError instanceof Error
            ? grantError.message
            : "Unable to grant extra attempt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMessage() {
    if (!data || !messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendScoreMessage({
        assessmentId,
        membershipIds: [data.learner.membershipId],
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setMessageSubject("");
      setMessageBody("");
      setMessageOpen(false);
    } catch (messageError) {
      setError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyId(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
  }

  const rosterHref = `/admin/reports/progress-score/scores/quizzes/${assessmentId}`;
  const learnerName = data?.learner.learnerName ?? data?.learner.email ?? "Learner";

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-28">
        <ProgressScoreReportTabs active="scores" />
        <ReviewSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-28">
      <ProgressScoreReportTabs active="scores" />

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">{error}</span>
          </div>
          <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {!data ? null : (
        <>
          <nav
            className="flex items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link
              href="/admin/reports/progress-score/scores"
              className="hover:text-[var(--admin-primary)]"
            >
              Scores
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <Link
              href={rosterHref}
              className="max-w-[160px] truncate hover:text-[var(--admin-primary)]"
            >
              {data.assessment.title}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate text-[var(--admin-on-surface)]">{learnerName}</span>
          </nav>

          <header className="flex flex-col gap-6 border-b border-[var(--admin-border)] pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <Link
                href={rosterHref}
                className="mb-3 inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                All learners
              </Link>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
                  Attempt {data.attempt.attemptNumber} of {data.attempt.ofAllowed} — {learnerName}
                </h1>
                <span
                  className={`rounded-sm border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${resultPillClass(data.attempt.resultStatus)}`}
                >
                  {data.attempt.resultStatus.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]"
                  onClick={() => void copyId(data.attempt.attemptId)}
                >
                  {data.attempt.shortId}
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span>·</span>
                <span>Submitted {formatSubmitted(data.attempt.submittedAt)}</span>
                <span>·</span>
                <span className="text-[var(--admin-on-surface)]">
                  {formatDuration(data.attempt.durationSeconds)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 flex overflow-hidden rounded-sm border border-[var(--admin-border)]">
                <button
                  type="button"
                  className="border-r border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 disabled:opacity-40"
                  disabled={!data.nav.prevAttemptId}
                  aria-label="Previous attempt"
                  onClick={() => {
                    if (data.nav.prevAttemptId) {
                      router.push(
                        `/admin/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${data.nav.prevAttemptId}`,
                      );
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bg-[var(--admin-surface)] p-2 disabled:opacity-40"
                  disabled={!data.nav.nextAttemptId}
                  aria-label="Next attempt"
                  onClick={() => {
                    if (data.nav.nextAttemptId) {
                      router.push(
                        `/admin/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${data.nav.nextAttemptId}`,
                      );
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <Link
                href={`/admin/members/${data.learner.membershipId}`}
                className={`${ghostButtonClassName} inline-flex items-center gap-2`}
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Open Profile
              </Link>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={busy || dirtyItems.length === 0}
                onClick={() => void handleSave()}
              >
                Save Grading
              </button>
            </div>
          </header>

          <section className="flex flex-col items-stretch gap-6 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:flex-row lg:items-center">
            <div className="w-full shrink-0 border-[var(--admin-border)] lg:w-64 lg:border-r lg:pr-8">
              <div className="mb-1 font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                Score
              </div>
              <div className="mb-2 font-mono text-[32px] font-bold tabular-nums text-[var(--admin-on-surface)]">
                {formatPct(data.attempt.scorePct)}
              </div>
              <div className="relative mb-2 h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className={`absolute inset-y-0 left-0 ${
                    data.attempt.resultStatus === "pass"
                      ? "bg-[var(--admin-primary)]"
                      : "bg-[var(--admin-danger)]"
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, data.attempt.scorePct ?? 0))}%`,
                  }}
                />
                {data.assessment.passMarkPercent != null ? (
                  <div
                    className="absolute inset-y-0 z-10 w-0.5 bg-[var(--admin-on-surface)]"
                    style={{ left: `${data.assessment.passMarkPercent}%` }}
                  />
                ) : null}
              </div>
              {data.summary.pointsShortfall != null ? (
                <p className="font-mono text-[11px] text-[var(--admin-danger)]">
                  Pass mark {formatPct(data.assessment.passMarkPercent)} — short by{" "}
                  {data.summary.pointsShortfall} points
                </p>
              ) : data.assessment.passMarkPercent != null ? (
                <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  Pass mark {formatPct(data.assessment.passMarkPercent)}
                </p>
              ) : null}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Accuracy
                </span>
                <p className="text-base text-[var(--admin-on-surface)]">
                  Correct{" "}
                  <span className="font-mono font-bold text-[var(--admin-primary)]">
                    {data.summary.correctCount}
                  </span>{" "}
                  of {data.summary.questionCount}
                </p>
              </div>
              <div className="border-l border-[var(--admin-border)] pl-6">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Completion
                </span>
                <p className="flex items-center gap-2 font-bold text-[var(--admin-warning)]">
                  Unanswered {data.summary.unansweredCount}
                  {data.summary.unansweredCount > 0 ? (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  ) : null}
                </p>
              </div>
              <div className="border-l border-[var(--admin-border)] pl-6">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Duration
                </span>
                <p className="text-[var(--admin-on-surface)]">
                  <span className="font-mono font-bold">
                    {formatDuration(data.attempt.durationSeconds)}
                  </span>
                  {data.summary.timeLimitSeconds != null
                    ? ` of ${formatDuration(data.summary.timeLimitSeconds)}`
                    : ""}
                </p>
              </div>
              <div className="border-l border-[var(--admin-border)] pl-6">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Attempts
                </span>
                <p className="text-[var(--admin-on-surface)]">
                  Attempt <span className="font-mono font-bold">{data.attempt.attemptNumber}</span>{" "}
                  of {data.attempt.ofAllowed} allowed
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex flex-col gap-6 lg:w-[68%]">
              <h2 className="border-b border-[var(--admin-border)] pb-4 text-xl font-semibold text-[var(--admin-on-surface)]">
                Question Review
              </h2>
              {data.questions.map((question) => {
                const meta = outcomeMeta(question.outcome);
                const Icon = meta.Icon;
                const draft = drafts[question.assessmentItemId];
                return (
                  <div
                    key={question.assessmentItemId}
                    className="relative overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6"
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 ${meta.rail}`} />
                    <div className="mb-6 flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--admin-border)] bg-[var(--admin-surface)] font-mono text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
                        {String(question.position + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1">
                        <div className={`mb-2 flex items-center gap-2 ${meta.className}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                            {meta.label} (
                            {question.pointsAwarded == null ? "—" : question.pointsAwarded}/
                            {question.pointsMax} pt)
                          </span>
                        </div>
                        <p className="text-lg leading-relaxed text-[var(--admin-on-surface)]">
                          {question.stem}
                        </p>
                        {question.cohortCorrectRatePct != null ? (
                          <p className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatPct(question.cohortCorrectRatePct)} of learners answered this
                            correctly
                            {question.durationSeconds != null
                              ? ` · ${formatDuration(question.durationSeconds)} on this item`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {question.isManual ? (
                      <div className="flex flex-col gap-6 pl-14 lg:flex-row">
                        <div className="flex-1">
                          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                            Learner Response
                          </div>
                          <div className="min-h-[120px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm text-[var(--admin-on-surface)] shadow-inner">
                            {question.learnerAnswerText ?? (
                              <span className="italic text-[var(--admin-on-surface-variant)]">
                                No response submitted.
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex w-full flex-col rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 lg:w-64">
                          <div className="mb-4 flex items-center justify-between border-b border-[var(--admin-border)] pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface)]">
                            Manual Override
                          </div>
                          <label className="mb-1 block font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            Award Marks
                          </label>
                          <div className="mb-4 flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={question.pointsMax}
                              step={0.5}
                              className="w-20 rounded-sm border border-[var(--admin-primary)] bg-[var(--admin-surface-low)] px-3 py-2 text-center font-mono text-[13px] text-[var(--admin-primary)] outline-none"
                              value={draft?.pointsAwarded ?? ""}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [question.assessmentItemId]: {
                                    pointsAwarded: event.target.value,
                                    feedback: prev[question.assessmentItemId]?.feedback ?? "",
                                  },
                                }));
                              }}
                            />
                            <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                              / {question.pointsMax} pts
                            </span>
                          </div>
                          <label className="mb-1 block font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            Instructor Feedback (Optional)
                          </label>
                          <textarea
                            rows={3}
                            className="mb-2 w-full resize-none rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 text-sm outline-none focus:border-[var(--admin-primary)]"
                            placeholder="Optional feedback…"
                            value={draft?.feedback ?? ""}
                            onChange={(event) => {
                              setDrafts((prev) => ({
                                ...prev,
                                [question.assessmentItemId]: {
                                  pointsAwarded:
                                    prev[question.assessmentItemId]?.pointsAwarded ?? "",
                                  feedback: event.target.value,
                                },
                              }));
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 pl-14">
                        {question.options.map((option) => {
                          const learnerRail = option.selectedByLearner;
                          const correctRail = option.isCorrect;
                          return (
                            <div
                              key={option.optionId}
                              className={[
                                "flex items-center justify-between rounded-r-sm border border-l-0 border-[var(--admin-border)] bg-[var(--admin-surface)] py-3 pl-4 pr-4",
                                learnerRail && !correctRail
                                  ? "border-l-4 border-l-[color:var(--admin-outline)]"
                                  : "",
                                correctRail ? "border-l-4 border-l-[var(--admin-primary)]" : "",
                                learnerRail && !correctRail
                                  ? "!border-l-[var(--admin-primary)]"
                                  : "",
                              ].join(" ")}
                              style={
                                learnerRail && !correctRail
                                  ? { borderLeftColor: "var(--admin-primary)", borderLeftWidth: 4 }
                                  : undefined
                              }
                            >
                              <span
                                className={[
                                  "text-sm",
                                  correctRail
                                    ? "font-medium text-[var(--admin-on-surface)]"
                                    : "text-[var(--admin-on-surface-variant)]",
                                ].join(" ")}
                              >
                                {option.label}
                              </span>
                              <div className="flex items-center gap-2">
                                {learnerRail && correctRail ? (
                                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-primary)]">
                                    Selected & Correct
                                  </span>
                                ) : null}
                                {learnerRail && !correctRail ? (
                                  <span
                                    className="rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase"
                                    style={{
                                      borderColor: "var(--admin-primary)",
                                      color: "var(--admin-primary)",
                                    }}
                                  >
                                    Learner Choice
                                  </span>
                                ) : null}
                                {correctRail && !learnerRail ? (
                                  <span className="rounded-sm border border-[var(--admin-primary)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--admin-primary)]">
                                    Correct Answer
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                        {question.outcome === "unanswered" &&
                        question.correctOptionIds.length === 0 &&
                        question.options.length === 0 ? (
                          <p className="text-sm italic text-[var(--admin-on-surface-variant)]">
                            No response recorded.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-6 lg:w-[32%]">
              <div className="flex flex-col rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-4 text-lg font-semibold text-[var(--admin-on-surface)]">
                  <History className="h-5 w-5" aria-hidden="true" />
                  Attempt History
                </div>
                <div>
                  {data.history.map((item) => {
                    if (item.isAvailableSlot) {
                      return (
                        <div
                          key={`slot-${item.attemptNumber}`}
                          className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3 opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                              {String(item.attemptNumber).padStart(2, "0")}
                            </span>
                            <span className="italic text-[var(--admin-on-surface-variant)]">
                              Available
                            </span>
                          </div>
                          <Lock className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                        </div>
                      );
                    }
                    const row = (
                      <div
                        className={[
                          "flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3 transition-colors",
                          item.isCurrent
                            ? "border-l-2 border-l-[var(--admin-primary)] bg-[var(--admin-surface-high)]"
                            : "hover:bg-[var(--admin-surface)]",
                        ].join(" ")}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[13px] ${item.isCurrent ? "font-bold text-[var(--admin-primary)]" : "text-[var(--admin-on-surface-variant)]"}`}
                            >
                              {String(item.attemptNumber).padStart(2, "0")}
                            </span>
                            <span className="text-sm text-[var(--admin-on-surface)]">
                              {item.isCurrent ? "Current Review" : `Attempt ${item.attemptNumber}`}
                            </span>
                            {item.scoreDelta != null ? (
                              <span
                                className={`font-mono text-[11px] ${item.scoreDelta >= 0 ? "text-[var(--admin-primary)]" : "text-[var(--admin-danger)]"}`}
                              >
                                {item.scoreDelta >= 0 ? "↑" : "↓"}
                                {Math.abs(item.scoreDelta)}
                              </span>
                            ) : null}
                          </div>
                          <span className="ml-6 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatSubmitted(item.submittedAt)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${resultPillClass(item.resultStatus)}`}
                          >
                            {item.resultStatus}
                          </span>
                          <span className="font-mono text-[13px] font-bold tabular-nums">
                            {formatPct(item.scorePct)}
                          </span>
                        </div>
                      </div>
                    );
                    if (item.isCurrent || !item.attemptId)
                      return <div key={item.attemptId ?? item.attemptNumber}>{row}</div>;
                    return (
                      <Link
                        key={item.attemptId}
                        href={`/admin/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${item.attemptId}`}
                        className="block"
                      >
                        {row}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-4 text-lg font-semibold text-[var(--admin-on-surface)]">
                  <ShieldAlert className="h-5 w-5 text-[var(--admin-warning)]" aria-hidden="true" />
                  Integrity Flags
                </div>
                <div className="flex flex-col gap-3 p-4">
                  {data.integrity.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No integrity flags recorded.
                    </p>
                  ) : (
                    data.integrity.map((flag) => (
                      <div
                        key={flag.key}
                        className="flex items-start justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"
                      >
                        <span className="text-sm text-[var(--admin-on-surface)]">{flag.label}</span>
                        <span
                          className={`shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${severityClass(flag.severity)}`}
                        >
                          {flag.severity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-4 text-lg font-semibold text-[var(--admin-on-surface)]">
                  <Wrench className="h-5 w-5" aria-hidden="true" />
                  Administrative Actions
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <button
                    type="button"
                    className={`${ghostButtonClassName} inline-flex w-full items-center justify-center gap-2`}
                    disabled={busy || data.attempt.status === "VOIDED"}
                    onClick={() => void handleReset()}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Reset Attempt
                  </button>
                  <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    Voids this attempt so the learner can use the slot again.
                  </p>
                  <button
                    type="button"
                    className={`${ghostButtonClassName} inline-flex w-full items-center justify-center gap-2`}
                    disabled={busy}
                    onClick={() => void handleGrant()}
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    Grant Extra Attempt
                  </button>
                  <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    Raises the attempt limit for this learner only.
                  </p>
                  <button
                    type="button"
                    className={`${ghostButtonClassName} inline-flex w-full items-center justify-center gap-2`}
                    onClick={() => {
                      setMessageOpen((o) => !o);
                    }}
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Message Learner
                  </button>
                  {messageOpen ? (
                    <div className="grid gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                      <input
                        className="h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-xs"
                        placeholder="Subject"
                        value={messageSubject}
                        onChange={(event) => {
                          setMessageSubject(event.target.value);
                        }}
                      />
                      <textarea
                        className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-xs"
                        rows={3}
                        placeholder="Message"
                        value={messageBody}
                        onChange={(event) => {
                          setMessageBody(event.target.value);
                        }}
                      />
                      <button
                        type="button"
                        className={primaryButtonClassName}
                        disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                        onClick={() => void handleMessage()}
                      >
                        Send
                      </button>
                    </div>
                  ) : null}
                  <hr className="border-[var(--admin-border)]" />
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] py-2.5 font-mono text-[12px] text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)] hover:text-[var(--admin-on-danger)] disabled:opacity-40"
                    disabled={busy || data.attempt.status === "VOIDED"}
                    onClick={() => {
                      setVoidOpen(true);
                    }}
                  >
                    Void Attempt
                  </button>
                  <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    Excludes from reports; kept for audit with a reason.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {dirtyItems.length > 0 ? (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--admin-primary)] bg-[var(--admin-surface)] p-4 shadow-[0_-8px_30px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)] md:left-[var(--admin-sidebar-width,0px)]">
              <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]">
                    <RefreshCw className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--admin-primary)]">
                      Unsaved Changes
                    </div>
                    <div className="text-sm text-[var(--admin-on-surface)]">
                      <span className="font-mono font-bold">
                        {dirtyItems.length} question{dirtyItems.length === 1 ? "" : "s"} regraded
                      </span>{" "}
                      · new score{" "}
                      <span className="font-mono font-bold text-[var(--admin-primary)]">
                        {formatPct(previewScore)}
                      </span>
                      {data.attempt.resultStatus !== previewResult ? (
                        <>
                          {" "}
                          — result would change from{" "}
                          <span className="px-1 text-[var(--admin-danger)] line-through">
                            {data.attempt.resultStatus}
                          </span>{" "}
                          to{" "}
                          <span className="font-bold text-[var(--admin-primary)]">
                            {previewResult}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={`${ghostButtonClassName} border-2`}
                    disabled={busy}
                    onClick={() => void load()}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={busy}
                    onClick={() => void handleSave()}
                  >
                    Save Grading
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <VoidModal
            open={voidOpen}
            learnerName={learnerName}
            attemptLabel={`Attempt ${data.attempt.attemptNumber}`}
            scorePct={data.attempt.scorePct}
            busy={busy}
            onClose={() => {
              setVoidOpen(false);
            }}
            onConfirm={(reason) => void handleVoid(reason)}
          />
        </>
      )}
    </div>
  );
}
