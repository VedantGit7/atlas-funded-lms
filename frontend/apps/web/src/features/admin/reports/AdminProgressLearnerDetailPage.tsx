"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  Info,
  Mail,
  RefreshCw,
  RotateCcw,
  User,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  extendProgressLearnerAccess,
  fetchProgressLearnerDetail,
  resetProgressLearner,
  sendProgressMessage,
  type ProgressLearnerDetail,
  type ProgressProductType,
} from "./admin-progress-score-roster-api";
import { ResetProgressModal } from "./ResetProgressModal";

type AdminProgressLearnerDetailPageProps = {
  productType: ProgressProductType;
  productId: string;
  enrollmentId: string;
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

function learnerInitials(name: string, email: string | null): string {
  const source = (name.trim() || email?.trim() || "?").split(/\s+/).filter(Boolean);
  if (source.length === 0) return "?";
  if (source.length === 1) return (source[0] ?? "").slice(0, 2).toUpperCase();
  return `${source[0]?.[0] ?? ""}${source[1]?.[0] ?? ""}`.toUpperCase();
}

function formatRelative(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Just now";
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatAbsolute(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExpiryChip(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Expires ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function paymentLabel(status: ProgressLearnerDetail["learner"]["paymentStatus"]): string {
  if (status === "paid") return "Paid";
  if (status === "comped") return "Comped";
  if (status === "trial") return "Trial";
  return "Unknown";
}

function accessLabel(status: ProgressLearnerDetail["learner"]["accessStatus"]): string {
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Revoked";
  return "Pending";
}

function lessonTypeLabel(type: string): string {
  if (type === "video") return "Video";
  if (type === "quiz") return "Quiz";
  if (type === "reading") return "Reading";
  if (type === "interactive") return "Interactive";
  return "Lesson";
}

function productTypeLabel(type: ProgressProductType): string {
  if (type === "course") return "Course";
  if (type === "test_series") return "Test series";
  if (type === "bundle") return "Bundle";
  if (type === "subscription") return "Subscription";
  return "Mock test";
}

function shortEnrollmentId(id: string): string {
  const clean = id.replace(/-/g, "").toUpperCase();
  return `ENR-${clean.slice(0, 6)}${clean.slice(-1)}`;
}

function heatmapLevelClass(level: number): string {
  if (level >= 4) return "bg-[var(--admin-primary-strong)]";
  if (level === 3) return "bg-[color-mix(in_srgb,var(--admin-primary)_70%,transparent)]";
  if (level === 2) return "bg-[color-mix(in_srgb,var(--admin-primary)_40%,transparent)]";
  if (level === 1) return "bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]";
  return "bg-[var(--admin-surface-high)]";
}

function chunkWeeks(
  days: ProgressLearnerDetail["activity"]["days"],
): Array<Array<ProgressLearnerDetail["activity"]["days"][number]>> {
  const weeks: Array<Array<ProgressLearnerDetail["activity"]["days"][number]>> = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function monthLabels(days: ProgressLearnerDetail["activity"]["days"]): string[] {
  if (days.length === 0) return [];
  const labels: string[] = [];
  let lastMonth = "";
  for (const day of days) {
    const month = new Date(`${day.date}T00:00:00`).toLocaleString(undefined, { month: "short" });
    if (month !== lastMonth) {
      labels.push(month);
      lastMonth = month;
    }
  }
  return labels.slice(0, 4);
}

function defaultExtendDate(currentExpiresAt: string | null): string {
  const base = currentExpiresAt ? new Date(currentExpiresAt) : new Date();
  if (Number.isNaN(base.getTime()) || base.getTime() < Date.now()) {
    base.setTime(Date.now());
  }
  base.setDate(base.getDate() + 30);
  return base.toISOString().slice(0, 10);
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex items-center gap-6 border-b border-[var(--admin-border)] px-4 py-8 md:px-8">
        <Shimmer className="h-16 w-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-3">
          <Shimmer className="h-9 w-64 max-w-full" />
          <Shimmer className="h-4 w-48 max-w-full opacity-70" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-5 md:px-8">
        {Array.from({ length: 5 }).map((_, index) => (
          <Shimmer key={index} className="h-24 border border-[var(--admin-border)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 px-4 md:px-8 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-8">
          <Shimmer className="mb-2 h-6 w-48" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Shimmer key={index} className="h-14 border border-[var(--admin-border)]" />
          ))}
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Shimmer className="h-48 border border-[var(--admin-border)]" />
          <Shimmer className="h-40 border border-[var(--admin-border)]" />
          <Shimmer className="h-44 border border-[var(--admin-border)]" />
        </div>
      </div>
    </div>
  );
}

export function AdminProgressLearnerDetailPage({
  productType,
  productId,
  enrollmentId,
}: AdminProgressLearnerDetailPageProps) {
  const [detail, setDetail] = useState<ProgressLearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extendBusy, setExtendBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);

  const rosterHref = `/admin/reports/progress-score/progress/${productType}/${productId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchProgressLearnerDetail(productType, productId, enrollmentId);
      setDetail(response.data);
      setExtendDate(defaultExtendDate(response.data.learner.expiresAt));
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load learner progress.",
      );
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, productId, productType]);

  useEffect(() => {
    void load();
  }, [load]);

  const weeks = useMemo(() => (detail ? chunkWeeks(detail.activity.days) : []), [detail]);
  const months = useMemo(() => (detail ? monthLabels(detail.activity.days) : []), [detail]);

  async function handleReset(payload: { clearAssessmentAttempts: boolean; reason: string }) {
    setResetBusy(true);
    try {
      await resetProgressLearner(productType, productId, enrollmentId, payload);
      setResetOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to reset progress.",
      );
    } finally {
      setResetBusy(false);
    }
  }

  async function handleExtend() {
    if (!extendDate) return;
    setExtendBusy(true);
    setError(null);
    try {
      await extendProgressLearnerAccess(productType, productId, enrollmentId, {
        expiresAt: `${extendDate}T23:59:59.999Z`,
      });
      setExtendOpen(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to extend access.",
      );
    } finally {
      setExtendBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!detail || !messageSubject.trim() || !messageBody.trim()) return;
    setMessageBusy(true);
    setError(null);
    try {
      await sendProgressMessage({
        productType,
        productId,
        ...(productType === "course" ? { courseId: productId } : {}),
        membershipIds: [detail.learner.membershipId],
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to send message.",
      );
    } finally {
      setMessageBusy(false);
    }
  }

  if (loading && !detail) {
    return <LoadingSkeleton />;
  }

  if (error && !detail) {
    return (
      <div className="flex flex-col items-start gap-4 px-4 py-10 md:px-8">
        <div className="flex items-start gap-3 border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[var(--admin-on-surface)]">Couldn’t load progress</p>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={rosterHref} className={`${ghostButtonClassName} h-9 gap-2`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All learners
          </Link>
          <button
            type="button"
            className={`${primaryButtonClassName} h-9 gap-2`}
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const expiryChip = formatExpiryChip(detail.learner.expiresAt);
  const memberHref = `/admin/members/${detail.learner.membershipId}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/95 px-4 py-6 backdrop-blur-sm md:px-8 md:py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href={rosterHref}
            className="inline-flex items-center gap-2 font-mono text-xs font-medium tracking-[0.05em] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-success)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All learners
          </Link>
          <span className="text-[var(--admin-outline)]" aria-hidden="true">
            |
          </span>
          <nav
            className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <span>Admin</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reports</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link
              href="/admin/reports/progress-score"
              className="hover:text-[var(--admin-on-surface)]"
            >
              Progress &amp; Score
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link
              href="/admin/reports/progress-score/progress"
              className="hover:text-[var(--admin-on-surface)]"
            >
              Progress
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{productTypeLabel(productType)}</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[var(--admin-on-surface)]">{detail.product.title}</span>
          </nav>
        </div>

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex items-center gap-5">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
              {detail.learner.avatarUrl ? (
                <img src={detail.learner.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                  {learnerInitials(detail.learner.displayName, detail.learner.email)}
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="truncate text-3xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-4xl">
                {detail.learner.displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  {detail.learner.email ?? "No email"}
                </span>
                <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-[var(--admin-on-surface)] uppercase">
                  {paymentLabel(detail.learner.paymentStatus)}
                </span>
                <span
                  className={[
                    "rounded-sm border px-2 py-1 font-mono text-[10px] tracking-[0.12em] uppercase",
                    detail.learner.accessStatus === "active"
                      ? "border-[var(--admin-success)] bg-[var(--admin-bg)] text-[var(--admin-success)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                >
                  {accessLabel(detail.learner.accessStatus)}
                </span>
                {expiryChip ? (
                  <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-[var(--admin-on-surface-variant)] uppercase">
                    {expiryChip}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={memberHref}
              className={`${ghostButtonClassName} h-9 gap-2 border border-[var(--admin-border)]`}
            >
              <User className="h-4 w-4" aria-hidden="true" />
              Open member profile
            </Link>
            {detail.capabilities.canMessage ? (
              <button
                type="button"
                className={`${ghostButtonClassName} h-9 gap-2 border border-[var(--admin-border)]`}
                onClick={() => {
                  setMessageOpen(true);
                }}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Send message
              </button>
            ) : null}
            {detail.capabilities.canExtendAccess ? (
              <button
                type="button"
                className="inline-flex h-9 items-center border-2 border-[var(--admin-on-surface)] bg-transparent px-4 font-mono text-xs font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-on-surface)] hover:text-[var(--admin-bg)]"
                onClick={() => {
                  setExtendDate(defaultExtendDate(detail.learner.expiresAt));
                  setExtendOpen(true);
                }}
              >
                Extend access
              </button>
            ) : null}
            {detail.capabilities.canResetProgress ? (
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 border-2 border-[var(--admin-warning)] bg-transparent px-4 font-mono text-xs font-bold text-[var(--admin-warning)] transition-colors hover:bg-[var(--admin-warning)] hover:text-[var(--admin-on-primary)]"
                onClick={() => {
                  setResetOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset progress
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-4 flex items-start gap-2 border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)] md:mx-8">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <section className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5 md:gap-8">
          <div className="flex flex-col justify-center gap-3 border-[var(--admin-border)] md:col-span-2 md:border-r md:pr-8">
            <div className="flex w-full items-end justify-between">
              <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--admin-on-surface-variant)] uppercase">
                Completion
              </span>
              <span className="font-mono text-[32px] leading-none font-bold text-[var(--admin-success)]">
                {detail.summary.completionPct}%
              </span>
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full bg-[var(--admin-success)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.max(0, detail.summary.completionPct))}%` }}
              />
            </div>
            <span className="text-right font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {detail.summary.completedLessons} of {detail.summary.totalLessons} lessons
            </span>
          </div>
          <div className="flex flex-col justify-center gap-2 border-[var(--admin-border)] md:border-r md:pr-4">
            <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--admin-on-surface-variant)] uppercase">
              Time on content
            </span>
            <span className="font-mono text-xl text-[var(--admin-on-surface)]">
              {detail.summary.timeOnContentLabel ?? "—"}
            </span>
            {!detail.summary.timeOnContentLabel ? (
              <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                Not tracked yet
              </span>
            ) : null}
          </div>
          <div className="flex flex-col justify-center gap-2 border-[var(--admin-border)] md:border-r md:pr-4">
            <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--admin-on-surface-variant)] uppercase">
              Last active
            </span>
            <span className="font-mono text-xl text-[var(--admin-on-surface)]">
              {formatRelative(detail.summary.lastActiveAt)}
            </span>
          </div>
          <div className="flex flex-col justify-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--admin-on-surface-variant)] uppercase">
              Assessments
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl text-[var(--admin-success)]">
                {detail.summary.assessmentsPassed}
              </span>
              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                of {detail.summary.assessmentsTotal} passed
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 px-4 py-10 md:px-8 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-8 lg:col-span-8">
          {!detail.capabilities.curriculumAvailable ? (
            <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <p className="font-semibold text-[var(--admin-on-surface)]">
                Lesson checklist unavailable
              </p>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Curriculum drill-down is supported for courses. This{" "}
                {productTypeLabel(productType).toLowerCase()} enrolment shows enrolment and
                assessment context only.
              </p>
            </div>
          ) : detail.modules.length === 0 ? (
            <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <p className="font-semibold text-[var(--admin-on-surface)]">No lessons published</p>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                This course has no modules or lessons yet, so there is nothing to track.
              </p>
            </div>
          ) : (
            detail.modules.map((module) => (
              <section
                key={module.moduleId}
                className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
              >
                <div className="sticky top-[9.5rem] z-10 flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:p-6">
                  <h2 className="m-0 text-xl font-bold text-[var(--admin-on-surface)] md:text-2xl">
                    {module.title}
                  </h2>
                  <span className="border border-[var(--admin-success)] bg-[var(--admin-bg)] px-3 py-1 font-mono text-[11px] text-[var(--admin-success)]">
                    {module.completedLessons} of {module.totalLessons} complete
                  </span>
                </div>
                <div className="flex flex-col">
                  {module.lessons.map((lesson, index) => {
                    const isLast = index === module.lessons.length - 1;
                    const completed = lesson.status === "completed";
                    const inProgress = lesson.status === "in_progress";
                    return (
                      <div
                        key={lesson.lessonId}
                        className={[
                          "group relative flex items-start gap-4 p-4 transition-colors hover:bg-[var(--admin-surface-variant)]",
                          !isLast ? "border-b border-[var(--admin-border)]" : "",
                          lesson.outOfOrder
                            ? "border-l-4 border-l-[var(--admin-warning)] bg-[var(--admin-surface-low)]"
                            : "",
                          lesson.status === "not_started" ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        {completed ? (
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border-2 border-[var(--admin-success)] bg-[var(--admin-success)]">
                            <Check
                              className="h-3.5 w-3.5 text-[var(--admin-bg)]"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          </div>
                        ) : inProgress ? (
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 overflow-hidden rounded-sm border-2 border-[var(--admin-primary)] bg-transparent">
                            <div
                              className="h-full bg-[var(--admin-primary)]"
                              style={{
                                width: `${Math.min(100, Math.max(8, lesson.progressPct))}%`,
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mt-0.5 h-6 w-6 shrink-0 rounded-sm border-2 border-[var(--admin-outline)] bg-transparent" />
                        )}

                        <div className="z-10 flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "rounded-sm px-2 py-0.5 font-mono text-[10px] tracking-[0.06em]",
                                lesson.outOfOrder
                                  ? "border border-[var(--admin-warning)] bg-[var(--admin-bg)] text-[var(--admin-warning)]"
                                  : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                              ].join(" ")}
                            >
                              {lessonTypeLabel(lesson.lessonType)}
                            </span>
                            <span
                              className={[
                                "truncate text-sm font-medium",
                                completed || inProgress
                                  ? "text-[var(--admin-on-surface)]"
                                  : "text-[var(--admin-on-surface-variant)]",
                              ].join(" ")}
                            >
                              {lesson.title}
                            </span>
                          </div>
                          {lesson.outOfOrder ? (
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle
                                className="h-3.5 w-3.5 text-[var(--admin-warning)]"
                                aria-hidden="true"
                              />
                              <span className="font-mono text-[10px] tracking-wider text-[var(--admin-warning)] uppercase">
                                Completed out of order
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="z-10 flex shrink-0 items-center gap-5">
                          {lesson.quizScorePct != null ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono text-sm font-bold text-[var(--admin-success)]">
                                {Math.round(lesson.quizScorePct)}%
                              </span>
                              {lesson.quizAttemptId ? (
                                <Link
                                  href={`/admin/reports/progress-score/scores`}
                                  className="font-mono text-[10px] text-[var(--admin-on-surface-variant)] underline decoration-[var(--admin-outline)] underline-offset-2 hover:text-[var(--admin-on-surface)]"
                                >
                                  View attempt
                                </Link>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="flex min-w-[5.5rem] flex-col items-end gap-1">
                            <span
                              className={[
                                "font-mono text-[11px]",
                                inProgress
                                  ? "text-[var(--admin-primary)]"
                                  : "text-[var(--admin-on-surface-variant)]",
                              ].join(" ")}
                            >
                              {lesson.durationLabel ??
                                (lesson.status === "not_started" ? "—" : "—")}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {lesson.completedAt
                                ? formatAbsolute(lesson.completedAt)
                                : lesson.lastSeenAt
                                  ? `Last viewed ${formatRelative(lesson.lastSeenAt)}`
                                  : ""}
                            </span>
                          </div>
                        </div>

                        {(completed || inProgress) && lesson.lessonType === "video" ? (
                          <div
                            className={[
                              "absolute bottom-0 left-0 z-0 h-[2px] transition-opacity",
                              completed
                                ? "w-full bg-[var(--admin-success)] opacity-50 group-hover:opacity-100"
                                : "bg-[var(--admin-primary)] opacity-70",
                            ].join(" ")}
                            style={
                              inProgress
                                ? { width: `${Math.min(100, Math.max(0, lesson.progressPct))}%` }
                                : undefined
                            }
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <section className="relative flex flex-col gap-5 overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <div
              className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-[var(--admin-primary)] opacity-5 blur-[80px]"
              aria-hidden="true"
            />
            <h3 className="border-b border-[var(--admin-border)] pb-2 font-mono text-xs tracking-[0.12em] text-[var(--admin-on-surface)] uppercase">
              Activity
            </h3>
            {weeks.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No activity recorded for this enrolment yet.
              </p>
            ) : (
              <>
                <div className="flex gap-[3px] overflow-x-auto pb-1">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[3px]">
                      {week.map((day) => (
                        <div
                          key={day.date}
                          title={`${day.date}: ${day.count} event${day.count === 1 ? "" : "s"}`}
                          className={`h-3 w-3 rounded-[2px] ${heatmapLevelClass(day.level)}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  {months.map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>
                {detail.activity.longestGapLabel ? (
                  <div className="mt-1 flex items-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                    <Info
                      className="h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      Longest gap:{" "}
                      <strong className="font-semibold text-[var(--admin-on-surface)]">
                        {detail.activity.longestGapLabel}
                      </strong>
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="relative flex flex-col gap-5 overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <div
              className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-[var(--admin-success)] opacity-5 blur-[80px]"
              aria-hidden="true"
            />
            <h3 className="border-b border-[var(--admin-border)] pb-2 font-mono text-xs tracking-[0.12em] text-[var(--admin-on-surface)] uppercase">
              Assessment results
            </h3>
            {detail.assessments.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No assessments linked to this product yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {detail.assessments.map((assessment) => {
                  const passed = assessment.resultStatus === "pass";
                  const failed = assessment.resultStatus === "fail";
                  return (
                    <div
                      key={assessment.assessmentId}
                      className={[
                        "group/item flex flex-col border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 transition-colors",
                        passed
                          ? "hover:border-[var(--admin-success)]"
                          : failed
                            ? "hover:border-[var(--admin-danger)]"
                            : "hover:border-[var(--admin-outline)]",
                      ].join(" ")}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <span className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                          {assessment.title}
                        </span>
                        <span
                          className={[
                            "font-mono text-xl font-bold",
                            passed
                              ? "text-[var(--admin-success)]"
                              : failed
                                ? "text-[var(--admin-danger)]"
                                : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {assessment.scorePct == null
                            ? "—"
                            : `${Math.round(assessment.scorePct)}%`}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] uppercase",
                            passed
                              ? "bg-[var(--admin-success)] text-[var(--admin-bg)]"
                              : failed
                                ? "bg-[var(--admin-danger)] text-[var(--admin-bg)]"
                                : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {assessment.resultStatus === "in_progress"
                            ? "In progress"
                            : assessment.resultStatus}
                        </span>
                        {assessment.attemptNumber != null ? (
                          <span className="rounded-sm border border-[var(--admin-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            Attempt {assessment.attemptNumber}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[var(--admin-border)] pt-3">
                        <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                          {assessment.submittedAt
                            ? new Date(assessment.submittedAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                        {assessment.attemptId ? (
                          <Link
                            href={`/admin/reports/progress-score/scores`}
                            className={[
                              "inline-flex items-center gap-1 font-mono text-[11px] tracking-wider uppercase transition-transform group-hover/item:translate-x-0.5",
                              passed
                                ? "text-[var(--admin-success)]"
                                : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            Review attempt
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-5 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <h3 className="border-b border-[var(--admin-border)] pb-2 font-mono text-xs tracking-[0.12em] text-[var(--admin-on-surface)] uppercase">
              Enrolment
            </h3>
            <dl className="divide-y divide-[var(--admin-border)]">
              <div className="flex items-center justify-between py-3">
                <dt className="font-mono text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  ID
                </dt>
                <dd className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {shortEnrollmentId(detail.enrolment.enrollmentId)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="font-mono text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Type
                </dt>
                <dd className="text-sm text-[var(--admin-on-surface)]">
                  {detail.enrolment.enrolledType}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="font-mono text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Source
                </dt>
                <dd className="text-sm text-[var(--admin-on-surface-variant)]">
                  {detail.enrolment.sourceLabel ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="font-mono text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                  Granted by
                </dt>
                <dd className="text-sm text-[var(--admin-on-surface-variant)]">
                  {detail.enrolment.grantedByLabel ?? "—"}
                </dd>
              </div>
              <div className="mt-2 flex flex-col gap-2 border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                    Certificate issued
                  </span>
                  <Award
                    className={
                      detail.enrolment.certificateIssued
                        ? "h-4 w-4 text-[var(--admin-success)]"
                        : "h-4 w-4 text-[var(--admin-outline)]"
                    }
                    aria-hidden="true"
                  />
                </div>
                <span
                  className={
                    detail.enrolment.certificateIssued
                      ? "font-mono text-xs text-[var(--admin-on-surface)]"
                      : "font-mono text-xs text-[var(--admin-on-surface-variant)]"
                  }
                >
                  {detail.enrolment.certificateLabel ?? "N/A"}
                </span>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <ResetProgressModal
        open={resetOpen}
        learnerName={detail.learner.displayName}
        busy={resetBusy}
        onClose={() => {
          if (!resetBusy) setResetOpen(false);
        }}
        onConfirm={(payload) => void handleReset(payload)}
      />

      {extendOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="extend-access-title"
            className="w-full max-w-md border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
          >
            <div className="border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="extend-access-title"
                className="text-lg font-semibold text-[var(--admin-on-surface)]"
              >
                Extend access
              </h2>
            </div>
            <div className="flex flex-col gap-4 px-5 py-5">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase">
                  New expiry date
                </span>
                <input
                  type="date"
                  value={extendDate}
                  onChange={(event) => {
                    setExtendDate(event.target.value);
                  }}
                  disabled={extendBusy}
                  className="h-10 border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)] focus:border-[var(--admin-primary)] focus:outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={`${ghostButtonClassName} h-9`}
                disabled={extendBusy}
                onClick={() => {
                  setExtendOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${primaryButtonClassName} h-9`}
                disabled={extendBusy || !extendDate}
                onClick={() => void handleExtend()}
              >
                Save expiry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {messageOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-message-title"
            className="w-full max-w-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
          >
            <div className="border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="send-message-title"
                className="text-lg font-semibold text-[var(--admin-on-surface)]"
              >
                Message {detail.learner.displayName}
              </h2>
            </div>
            <div className="flex flex-col gap-4 px-5 py-5">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase">
                  Subject
                </span>
                <input
                  value={messageSubject}
                  onChange={(event) => {
                    setMessageSubject(event.target.value);
                  }}
                  disabled={messageBusy}
                  className="h-10 border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)] focus:border-[var(--admin-primary)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--admin-on-surface-variant)] uppercase">
                  Message
                </span>
                <textarea
                  rows={5}
                  value={messageBody}
                  onChange={(event) => {
                    setMessageBody(event.target.value);
                  }}
                  disabled={messageBusy}
                  className="resize-none border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 text-sm text-[var(--admin-on-surface)] focus:border-[var(--admin-primary)] focus:outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={`${ghostButtonClassName} h-9`}
                disabled={messageBusy}
                onClick={() => {
                  setMessageOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${primaryButtonClassName} h-9`}
                disabled={messageBusy || !messageSubject.trim() || !messageBody.trim()}
                onClick={() => void handleSendMessage()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
