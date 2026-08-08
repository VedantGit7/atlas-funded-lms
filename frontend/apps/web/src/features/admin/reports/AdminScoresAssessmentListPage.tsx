"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Search,
  Users,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createScoreGroup,
  exportScoreReport,
  fetchScoreQuizzes,
  sendScoreMessage,
  type ScorePassRateBand,
  type ScoreProductType,
  type ScoreQuizItem,
  type ScoreQuizSortBy,
  type ScoreQuizzesProduct,
  type ScoreQuizzesSummary,
} from "./admin-progress-score-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";

const PRODUCT_TYPE_LABEL: Record<ScoreProductType, string> = {
  course: "Course",
  test_series: "Test series",
  bundle: "Bundle",
  mock_test: "Mock test",
};

const ASSESSMENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Assessment type (Any)" },
  { value: "quiz", label: "Quiz" },
  { value: "graded_quiz", label: "Graded quiz" },
  { value: "mock_test", label: "Mock test" },
  { value: "practice_set", label: "Practice set" },
  { value: "assignment", label: "Assignment" },
];

const PASS_RATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Pass rate (Any)" },
  { value: "below_50", label: "Below 50%" },
  { value: "mid_50_75", label: "50–75%" },
  { value: "above_75", label: "Above 75%" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "title:asc", label: "Sort: Title A–Z" },
  { value: "attempts:desc", label: "Sort: Attempts ↓" },
  { value: "avg_score:desc", label: "Sort: Avg score ↓" },
  { value: "pass_rate:desc", label: "Sort: Pass rate ↓" },
  { value: "last_attempt:desc", label: "Sort: Last attempt ↓" },
  { value: "ungraded:desc", label: "Sort: Ungraded ↓" },
];

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / (1000 * 60));
  if (absMinutes < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absMinutes || -absMinutes,
      "minute",
    );
  }
  const absHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
  if (absHours < 48) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absHours,
      "hour",
    );
  }
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (absDays < 14) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absDays,
      "day",
    );
  }
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function humanizeType(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function openProductHref(productType: ScoreProductType): string {
  if (productType === "course") return "/admin/courses";
  if (productType === "mock_test") return "/admin/mock-tests";
  if (productType === "test_series") return "/admin/test-series";
  return "/admin/bundles";
}

function ScoreBar({
  value,
  passMark,
}: {
  value: number | null;
  passMark: number | null;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
      {passMark != null ? (
        <span
          className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--admin-on-surface)]"
          style={{ left: `${Math.max(0, Math.min(100, passMark))}%` }}
          title={`Pass mark ${formatPct(passMark)}`}
        />
      ) : null}
    </div>
  );
}

function ScoreSpreadRow({ item }: { item: ScoreQuizItem }) {
  const spread = item.scoreSpread;
  if (!spread) {
    return (
      <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">No scored attempts</p>
    );
  }
  const pass = item.passMarkPct;
  return (
    <div className="relative h-6 w-full">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--admin-border)]" />
      {pass != null ? (
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-[var(--admin-outline)]"
          style={{ left: `${pass}%` }}
        />
      ) : null}
      <div
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-surface))]"
        style={{
          left: `${spread.q1}%`,
          width: `${Math.max(1, spread.q3 - spread.q1)}%`,
        }}
      />
      <div
        className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-[var(--admin-on-surface)]"
        style={{ left: `${spread.median}%` }}
        title={`Median ${formatPct(spread.median)}`}
      />
      <div
        className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 bg-[var(--admin-outline)]"
        style={{ left: `${spread.min}%` }}
      />
      <div
        className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 bg-[var(--admin-outline)]"
        style={{ left: `${spread.max}%` }}
      />
    </div>
  );
}

function AssessmentListSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading assessments">
      <div className="space-y-3">
        <Shimmer className="h-3 w-72 max-w-full" />
        <Shimmer className="h-9 w-96 max-w-full" />
        <Shimmer className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 md:col-span-1">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-[3px] w-full" />
        </div>
        <div className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-8 w-20" />
        </div>
        <div className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-3 w-32" />
        </div>
      </div>
      <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
          <Shimmer className="h-3 w-full max-w-3xl" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <Shimmer className="col-span-2 h-4 w-3/4" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-10 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function AdminScoresAssessmentListPage({
  productType,
  productId,
}: {
  productType: ScoreProductType;
  productId: string;
}) {
  const router = useRouter();
  const searchId = useId();
  const ungradedId = useId();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScoreQuizItem[]>([]);
  const [product, setProduct] = useState<ScoreQuizzesProduct | null>(null);
  const [summary, setSummary] = useState<ScoreQuizzesSummary | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [passRateBand, setPassRateBand] = useState<ScorePassRateBand | "">("");
  const [hasUngraded, setHasUngraded] = useState(false);
  const [sortKey, setSortKey] = useState("title:asc");
  const [page, setPage] = useState(1);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sortByRaw, sortDirRaw] = sortKey.split(":");
    const sortBy = (sortByRaw ?? "title") as ScoreQuizSortBy;
    const sortDir = (sortDirRaw === "desc" ? "desc" : "asc") as "asc" | "desc";
    try {
      const response = await fetchScoreQuizzes(productType, productId, {
        q: debouncedQ || undefined,
        assessmentType: assessmentType || undefined,
        passRateBand,
        hasUngraded: hasUngraded || undefined,
        sortBy,
        sortDir,
        page,
        limit: 25,
      });
      setItems(response.data.items);
      setProduct(response.data.product);
      setSummary(response.data.summary);
      setPageInfo(response.data.pageInfo);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Failed to load assessment data.",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    assessmentType,
    debouncedQ,
    hasUngraded,
    page,
    passRateBand,
    productId,
    productType,
    sortKey,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilters = Boolean(
    debouncedQ || assessmentType || passRateBand || hasUngraded,
  );
  const empty = !loading && !error && items.length === 0;
  const productEmpty = empty && !hasActiveFilters && (summary?.assessmentCount ?? 0) === 0;

  const showingFrom = pageInfo.totalCount === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1;
  const showingTo = Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount);

  const title = product?.title ?? "Assessments";
  const typeLabel = PRODUCT_TYPE_LABEL[productType];

  const spreadItems = useMemo(
    () => items.filter((item) => item.scoreSpread != null).slice(0, 12),
    [items],
  );

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportScoreReport({
        productType,
        productId,
        courseId: productType === "course" ? productId : undefined,
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    if (!groupTitle.trim() || items.length === 0) return;
    const first = items[0];
    if (!first) return;
    setBusy(true);
    setError(null);
    try {
      await createScoreGroup({
        assessmentId: first.assessmentId,
        title: groupTitle.trim(),
      });
      setGroupTitle("");
    } catch (groupError) {
      setError(
        groupError instanceof ClientApiError
          ? groupError.message
          : groupError instanceof Error
            ? groupError.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim() || items.length === 0) return;
    const first = items[0];
    if (!first) return;
    setBusy(true);
    setError(null);
    try {
      await sendScoreMessage({
        assessmentId: first.assessmentId,
        subject: messageSubject.trim(),
        body: messageBody.trim(),
      });
      setMessageSubject("");
      setMessageBody("");
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

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-16">
      <ProgressScoreReportTabs active="scores" />

      {loading && !product ? (
        <AssessmentListSkeleton />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Link
                href="/admin/reports/progress-score/scores"
                className="inline-flex w-fit items-center gap-1 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                All courses
              </Link>
              <nav
                className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
                aria-label="Breadcrumb"
              >
                <span>Admin</span>
                <span className="text-[var(--admin-outline)]">/</span>
                <span>Reports</span>
                <span className="text-[var(--admin-outline)]">/</span>
                <span>Progress &amp; Score</span>
                <span className="text-[var(--admin-outline)]">/</span>
                <Link
                  href="/admin/reports/progress-score/scores"
                  className="hover:text-[var(--admin-primary)]"
                >
                  Scores
                </Link>
                <span className="text-[var(--admin-outline)]">/</span>
                <span>{typeLabel}</span>
                <span className="text-[var(--admin-outline)]">/</span>
                <span className="text-[var(--admin-on-surface)]">{title}</span>
              </nav>
            </div>

            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
                    {title}
                  </h1>
                  <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-primary)]">
                    {typeLabel}
                  </span>
                </div>
                {summary ? (
                  <p className="font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
                    {formatCount(summary.assessmentCount)} assessments ·{" "}
                    {formatCount(summary.learnersAttempted)} learners ·{" "}
                    {formatCount(summary.attemptCount)} attempts
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border-2 border-[var(--admin-on-surface)] bg-transparent leading-none text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50`}
                  disabled={busy || loading}
                  onClick={() => void handleExport()}
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Export CSV
                </button>
                <Link
                  href={openProductHref(productType)}
                  className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border-2 border-[var(--admin-on-surface)] bg-transparent leading-none text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]`}
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Open product
                </Link>
                <button
                  type="button"
                  className={`${primaryButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm leading-none`}
                  aria-expanded={cohortOpen}
                  onClick={() => setCohortOpen((open) => !open)}
                >
                  <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {cohortOpen ? "Hide cohort actions" : "Cohort actions"}
                </button>
              </div>
            </div>
          </section>

          {error ? (
            <section className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3">
                <div className="flex items-center gap-3 text-[var(--admin-danger)]">
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-[12px] font-bold uppercase tracking-[0.1em]">
                    Failed to load assessment data
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-sm border border-[var(--admin-danger)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)] hover:text-[var(--admin-surface)]"
                  onClick={() => void load()}
                >
                  Retry
                </button>
              </div>
              <p className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            </section>
          ) : null}

          {cohortOpen ? (
            <section className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Cohort actions use the first assessment on this page as audience seed. Open an
                assessment for a precise learner set.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <input
                    className="h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)]"
                    placeholder="Group title"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                  />
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={busy || !groupTitle.trim() || items.length === 0}
                    onClick={() => void handleCreateGroup()}
                  >
                    Create group
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    className="h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)]"
                    placeholder="Message subject"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                  />
                  <textarea
                    className="min-h-[72px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)]"
                    placeholder="Message body"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                  />
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={
                      busy || !messageSubject.trim() || !messageBody.trim() || items.length === 0
                    }
                    onClick={() => void handleSendMessage()}
                  >
                    Message learners
                  </button>
                </div>
              </div>
              <Link
                href="/admin/reports/progress-score/cohorts"
                className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-primary)] hover:underline"
              >
                Open cohorts →
              </Link>
            </section>
          ) : null}

          {summary && !productEmpty ? (
            <section
              className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-6"
              aria-label="Score summary"
            >
              <div className="flex flex-col gap-3 bg-[var(--admin-surface)] p-6 md:col-span-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Average score
                </p>
                <p className="font-mono text-[32px] font-medium tabular-nums leading-none text-[var(--admin-on-surface)]">
                  {formatPct(summary.avgScorePct)}
                </p>
                <ScoreBar value={summary.avgScorePct} passMark={null} />
              </div>
              <div className="flex flex-col gap-3 bg-[var(--admin-surface)] p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Pass rate
                </p>
                <p className="font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--admin-on-surface)]">
                  {formatPct(summary.passRatePct)}
                </p>
              </div>
              <div className="flex flex-col gap-3 bg-[var(--admin-surface)] p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Attempts
                </p>
                <p className="font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--admin-on-surface)]">
                  {formatCount(summary.attemptCount)}
                </p>
                <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {summary.attemptsPerLearner != null
                    ? `${summary.attemptsPerLearner} per learner`
                    : "No learners yet"}
                </p>
              </div>
              <div className="flex flex-col gap-3 bg-[var(--admin-surface)] p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Ungraded
                </p>
                <p
                  className={[
                    "font-mono text-[28px] font-medium tabular-nums leading-none",
                    summary.ungradedCount > 0
                      ? "text-[var(--admin-warning)]"
                      : "text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {formatCount(summary.ungradedCount)}
                </p>
              </div>
              <div className="flex flex-col gap-3 bg-[var(--admin-surface)] p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Median time
                </p>
                <p className="font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--admin-on-surface)]">
                  {summary.medianTimeLabel ?? "—"}
                </p>
              </div>
            </section>
          ) : null}

          {!productEmpty ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <label htmlFor={searchId} className="sr-only">
                  Search assessment title
                </label>
                <input
                  id={searchId}
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search assessment title"
                  className="h-9 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                />
              </div>
              <Select
                value={assessmentType}
                onValueChange={(value) => {
                  setAssessmentType(value);
                  setPage(1);
                }}
                options={ASSESSMENT_TYPE_OPTIONS}
                className={selectClassName}
                ariaLabel="Assessment type"
              />
              <Select
                value={passRateBand}
                onValueChange={(value) => {
                  setPassRateBand(value as ScorePassRateBand | "");
                  setPage(1);
                }}
                options={PASS_RATE_OPTIONS}
                className={selectClassName}
                ariaLabel="Pass rate band"
              />
              <button
                id={ungradedId}
                type="button"
                aria-pressed={hasUngraded}
                className={[
                  "inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                  hasUngraded
                    ? "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => {
                  setHasUngraded((current) => !current);
                  setPage(1);
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Has ungraded
              </button>
              <Select
                value={sortKey}
                onValueChange={(value) => {
                  setSortKey(value);
                  setPage(1);
                }}
                options={SORT_OPTIONS}
                className={selectClassName}
                ariaLabel="Sort assessments"
              />
            </div>
          ) : null}

          {productEmpty ? (
            <section className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-16 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
                <ClipboardList className="h-12 w-12" strokeWidth={1.25} aria-hidden="true" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                No Assessments Found
              </h2>
              <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--admin-on-surface-variant)]">
                This product has no assessments yet. Ensure the curriculum module is properly
                configured and published.
              </p>
              <Link
                href={openProductHref(productType)}
                className={`${primaryButtonClassName} inline-flex h-12 items-center gap-2 rounded-sm px-8 uppercase tracking-[0.12em]`}
              >
                Open Product
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          ) : empty ? (
            <section className="flex min-h-[280px] flex-col items-center justify-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-8 py-12 text-center">
              <h2 className="mb-2 text-xl font-semibold text-[var(--admin-on-surface)]">
                No assessments match these filters
              </h2>
              <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Adjust search, type, pass rate, or ungraded filters to widen the results.
              </p>
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setSearchInput("");
                  setDebouncedQ("");
                  setAssessmentType("");
                  setPassRateBand("");
                  setHasUngraded(false);
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            </section>
          ) : (
            <>
              <div className="hidden md:block">
                <div className="w-full overflow-x-auto rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                        <th className="min-w-[220px] px-4 py-3 font-medium">Assessment</th>
                        <th className="px-4 py-3 font-medium">Lesson</th>
                        <th className="px-4 py-3 text-right font-medium">Questions</th>
                        <th className="px-4 py-3 text-right font-medium">Pass mark</th>
                        <th className="px-4 py-3 text-right font-medium">Learners</th>
                        <th className="px-4 py-3 text-right font-medium">Attempts</th>
                        <th className="min-w-[140px] px-4 py-3 font-medium">Average score</th>
                        <th className="px-4 py-3 text-right font-medium">Pass rate</th>
                        <th className="px-4 py-3 text-right font-medium">Ungraded</th>
                        <th className="px-4 py-3 text-right font-medium">Last attempt</th>
                        <th className="w-10 px-4 py-3">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--admin-border)]">
                      {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                              <td colSpan={11} className="px-4 py-4">
                                <Shimmer className="h-8 w-full" />
                              </td>
                            </tr>
                          ))
                        : items.map((item) => {
                            const avgPer =
                              item.learnerCount > 0
                                ? Math.round((item.attemptCount / item.learnerCount) * 10) / 10
                                : null;
                            const passDanger =
                              item.passRatePct != null && item.passRatePct < 50;
                            return (
                              <tr
                                key={item.assessmentId}
                                className="cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                                onClick={() =>
                                  router.push(
                                    `/admin/reports/progress-score/scores/quizzes/${item.assessmentId}`,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    router.push(
                                      `/admin/reports/progress-score/scores/quizzes/${item.assessmentId}`,
                                    );
                                  }
                                }}
                                tabIndex={0}
                              >
                                <td className="px-4 py-3">
                                  <p className="font-medium text-[var(--admin-primary)]">
                                    {item.title}
                                  </p>
                                  <span className="mt-1 inline-block rounded-sm border border-[var(--admin-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                                    {humanizeType(item.assessmentType)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                                  {item.lessonTitle ?? (
                                    <span className="italic">Standalone</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums">
                                  {item.questionCount ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--admin-on-surface-variant)]">
                                  {item.passMarkPct == null ? "Not set" : formatPct(item.passMarkPct)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums">
                                  {formatCount(item.learnerCount)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <p className="font-mono tabular-nums">
                                    {formatCount(item.attemptCount)}
                                  </p>
                                  {avgPer != null ? (
                                    <p className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                      {avgPer} avg per learner
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="mb-1 font-mono tabular-nums">
                                    {formatPct(item.avgScorePct)}
                                  </p>
                                  <ScoreBar
                                    value={item.avgScorePct}
                                    passMark={item.passMarkPct}
                                  />
                                </td>
                                <td
                                  className={[
                                    "px-4 py-3 text-right font-mono tabular-nums",
                                    passDanger ? "text-[var(--admin-danger)]" : "",
                                  ].join(" ")}
                                >
                                  {formatPct(item.passRatePct)}
                                </td>
                                <td
                                  className={[
                                    "px-4 py-3 text-right font-mono tabular-nums",
                                    item.ungradedCount > 0 ? "text-[var(--admin-warning)]" : "",
                                  ].join(" ")}
                                >
                                  {item.ungradedCount > 0
                                    ? formatCount(item.ungradedCount)
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                                  {formatRelative(item.lastAttemptAt)}
                                </td>
                                <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {items.map((item) => (
                  <button
                    key={item.assessmentId}
                    type="button"
                    className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors active:scale-[0.99]"
                    onClick={() =>
                      router.push(
                        `/admin/reports/progress-score/scores/quizzes/${item.assessmentId}`,
                      )
                    }
                  >
                    <p className="font-medium text-[var(--admin-primary)]">{item.title}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      {humanizeType(item.assessmentType)} ·{" "}
                      {item.lessonTitle ?? "Standalone"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums text-[var(--admin-on-surface-variant)]">
                      <span>Avg {formatPct(item.avgScorePct)}</span>
                      <span>Pass {formatPct(item.passRatePct)}</span>
                      <span>{formatCount(item.attemptCount)} attempts</span>
                    </div>
                    {item.scoreSpread ? (
                      <p className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        Spread {formatPct(item.scoreSpread.min)} –{" "}
                        {formatPct(item.scoreSpread.median)} –{" "}
                        {formatPct(item.scoreSpread.max)}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>

              {spreadItems.length > 0 ? (
                <section className="hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 md:block">
                  <h2 className="mb-6 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                    Score spread by assessment
                  </h2>
                  <div className="mb-2 flex justify-between font-mono text-[10px] text-[var(--admin-outline)]">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                  <ul className="flex flex-col gap-4">
                    {spreadItems.map((item) => (
                      <li key={item.assessmentId} className="grid grid-cols-12 items-center gap-3">
                        <p className="col-span-3 truncate text-sm text-[var(--admin-on-surface)]">
                          {item.title}
                        </p>
                        <div className="col-span-9">
                          <ScoreSpreadRow item={item} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                <p>
                  Showing {showingFrom}–{showingTo} of {formatCount(pageInfo.totalCount)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={!pageInfo.hasPreviousPage || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Prev
                  </button>
                  <span>
                    Page {pageInfo.page}
                    {pageInfo.totalPages > 0 ? ` / ${pageInfo.totalPages}` : ""}
                  </span>
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={!pageInfo.hasNextPage || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
