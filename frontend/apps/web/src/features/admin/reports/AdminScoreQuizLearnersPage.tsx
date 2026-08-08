"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Search,
  SearchX,
  Users,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  SCORE_LEARNER_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportScoreReport,
  fetchScoreAttemptHistory,
  fetchScoreItemAnalysis,
  fetchScoreLearners,
  regradeScoreAttempts,
  type ScoreAttemptHistoryItem,
  type ScoreAttemptsFilter,
  type ScoreItemAnalysisItem,
  type ScoreLearnerColumnKey,
  type ScoreLearnerItem,
  type ScoreLearnerResultStatus,
  type ScoreLearnerView,
  type ScoreLearnersAssessment,
  type ScoreLearnersSummary,
  type ScoreProductType,
} from "./admin-progress-score-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { CohortActionsDrawer, type CohortDrawerMode } from "./CohortActionsDrawer";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";

type DetailTab = "learners" | "items" | "attempts";

const VIEW_TABS: Array<{ value: ScoreLearnerView; label: string }> = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "ungraded", label: "Ungraded" },
  { value: "improved_on_retry", label: "Improved on retry" },
];

const RESULT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Result: All" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
];

const ATTEMPTS_FILTER_OPTIONS: Array<{ value: ScoreAttemptsFilter; label: string }> = [
  { value: "any", label: "Attempts: All" },
  { value: "first_only", label: "First attempt only" },
  { value: "more_than_one", label: "More than one" },
];

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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

function formatCount(value: number): string {
  return value.toLocaleString();
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
  return `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

function formatSubmitted(iso: string | null, startedAt: string | null): string {
  if (iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (startedAt) {
    const date = new Date(startedAt);
    if (Number.isNaN(date.getTime())) return "—";
    return `Started ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return "—";
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function humanizeType(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function learnerInitials(learner: { learnerName: string | null; email: string | null }): string {
  const source = (learner.learnerName ?? learner.email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

function resultChipClass(status: ScoreLearnerResultStatus): string {
  if (status === "pass") {
    return "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]";
  }
  if (status === "fail") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "pending") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function scoreBarTone(status: ScoreLearnerResultStatus): string {
  if (status === "fail") return "bg-[var(--admin-danger)] text-[var(--admin-danger)]";
  if (status === "pass") return "bg-[var(--admin-primary)] text-[var(--admin-on-surface)]";
  return "bg-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]";
}

function productScoresHref(
  productType: ScoreProductType | null,
  productId: string | null,
  courseId: string | null,
): string {
  if (productType && productId) {
    return `/admin/reports/progress-score/scores/${productType}/${productId}`;
  }
  if (courseId) return `/admin/reports/progress-score/scores/course/${courseId}`;
  return "/admin/reports/progress-score/scores";
}

function ScoreBar({
  value,
  passMark,
  toneClass,
}: {
  value: number | null;
  passMark: number | null;
  toneClass: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const fill = toneClass.includes("danger")
    ? "bg-[var(--admin-danger)]"
    : "bg-[var(--admin-primary)]";
  return (
    <div className="relative h-1.5 w-20 overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
      <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${pct}%` }} />
      {passMark != null ? (
        <span
          className="absolute inset-y-0 w-px bg-[var(--admin-on-surface)]/50"
          style={{ left: `${Math.max(0, Math.min(100, passMark))}%` }}
        />
      ) : null}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading score roster">
      <div className="space-y-3">
        <Shimmer className="h-3 w-96 max-w-full" />
        <Shimmer className="h-9 w-[28rem] max-w-full" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-28" />
          <Shimmer className="h-4 w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
          <Shimmer className="h-8 w-full max-w-3xl" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RegradeModal({
  open,
  assessmentTitle,
  selectedCount,
  answerKeyVersion,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  assessmentTitle: string;
  selectedCount: number;
  answerKeyVersion: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (args: { scope: "selected" | "all"; notifyLearners: boolean }) => void;
}) {
  const titleId = useId();
  const [scope, setScope] = useState<"selected" | "all">("selected");
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (open) {
      setScope(selectedCount > 0 ? "selected" : "all");
      setNotify(false);
    }
  }, [open, selectedCount]);

  if (!open) return null;

  const countLabel = scope === "selected" ? selectedCount : "all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_55%,transparent)] p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-xl flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-6">
          <div>
            <h2
              id={titleId}
              className="text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]"
            >
              Regrade Assessment
            </h2>
            <p className="mt-1 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              {assessmentTitle}
            </p>
          </div>
          <button
            type="button"
            className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-start gap-3">
            <RefreshCw
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <p className="text-base leading-relaxed text-[var(--admin-on-surface)]">
              <strong className="text-[var(--admin-on-surface)]">
                {scope === "selected" ? `${selectedCount} attempt${selectedCount === 1 ? "" : "s"}` : "All attempts"}
              </strong>{" "}
              will be regraded against{" "}
              <strong className="text-[var(--admin-on-surface)]">Version {answerKeyVersion}</strong> of
              the answer key.
            </p>
          </div>

          <hr className="border-[var(--admin-border)]" />

          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="regrade-scope"
                checked={scope === "selected"}
                disabled={selectedCount === 0}
                onChange={() => setScope("selected")}
                className="accent-[var(--admin-primary)]"
              />
              <span className="text-sm text-[var(--admin-on-surface)]">
                Regrade selected attempts
                {selectedCount === 0 ? " (none selected)" : ` (${selectedCount})`}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="regrade-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="accent-[var(--admin-primary)]"
              />
              <span className="text-sm text-[var(--admin-on-surface)]">
                Regrade all attempts for this assessment
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3 border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[var(--admin-surface-low)] p-4">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-warning)]">
              Warning: Recorded results and pass/fail outcomes may change.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              className="accent-[var(--admin-primary)]"
            />
            <span className="text-sm text-[var(--admin-on-surface)]">Notify affected learners</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={`${ghostButtonClassName} border-2 border-[var(--admin-on-surface)] uppercase tracking-[0.1em]`}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} uppercase tracking-[0.1em]`}
            disabled={busy || (scope === "selected" && selectedCount === 0)}
            onClick={() => onConfirm({ scope, notifyLearners: notify })}
          >
            {busy ? "Regrading…" : `Regrade ${countLabel} attempts`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Screen 7 — Learner Score Roster / Item Analysis / Attempt History.
 * Reading this as: admin LMS operator console for assessment scoring, industrial green tokens via --admin-*.
 */
export function AdminScoreQuizLearnersPage({ assessmentId }: { assessmentId: string }) {
  const [tab, setTab] = useState<DetailTab>("learners");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [assessment, setAssessment] = useState<ScoreLearnersAssessment | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScoreLearnersSummary | null>(null);
  const [learners, setLearners] = useState<ScoreLearnerItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resultStatus, setResultStatus] = useState<"" | ScoreLearnerResultStatus>("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [attemptsFilter, setAttemptsFilter] = useState<ScoreAttemptsFilter>("any");
  const [view, setView] = useState<ScoreLearnerView>("all");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ScoreLearnerColumnKey[]>(
    SCORE_LEARNER_COLUMN_OPTIONS.map((c) => c.key),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<CohortDrawerMode>("group");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [regradeOpen, setRegradeOpen] = useState(false);

  const [itemAnalysis, setItemAnalysis] = useState<ScoreItemAnalysisItem[]>([]);
  const [belowFortyCount, setBelowFortyCount] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<ScoreAttemptHistoryItem[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [attemptsPage, setAttemptsPage] = useState(1);
  const [attemptsTotalPages, setAttemptsTotalPages] = useState(0);
  const [attemptsTotalCount, setAttemptsTotalCount] = useState(0);
  const [attemptSearch, setAttemptSearch] = useState("");
  const [debouncedAttemptSearch, setDebouncedAttemptSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAttemptSearch(attemptSearch.trim());
      setAttemptsPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [attemptSearch]);

  const parsedMinScore = useMemo(() => {
    const n = Number(minScore);
    return minScore.trim() && Number.isFinite(n) ? n : undefined;
  }, [minScore]);
  const parsedMaxScore = useMemo(() => {
    const n = Number(maxScore);
    return maxScore.trim() && Number.isFinite(n) ? n : undefined;
  }, [maxScore]);

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    Boolean(resultStatus) ||
    parsedMinScore != null ||
    parsedMaxScore != null ||
    attemptsFilter !== "any" ||
    view !== "all" ||
    Boolean(submittedFrom) ||
    Boolean(submittedTo);

  const loadLearners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchScoreLearners(assessmentId, {
        ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
        ...(resultStatus ? { resultStatus } : {}),
        ...(parsedMinScore != null ? { minScore: parsedMinScore } : {}),
        ...(parsedMaxScore != null ? { maxScore: parsedMaxScore } : {}),
        attemptsFilter,
        view,
        ...(dateInputToStartIso(submittedFrom)
          ? { submittedFrom: dateInputToStartIso(submittedFrom) }
          : {}),
        ...(dateInputToEndIso(submittedTo) ? { submittedTo: dateInputToEndIso(submittedTo) } : {}),
        sortBy: "submitted_at",
        sortDir: "desc",
        columns,
        page,
      });
      setAssessment(response.data.assessment);
      setCourseId(response.data.courseId);
      setCourseTitle(response.data.courseTitle);
      setSummary(response.data.summary);
      setLearners(response.data.items);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load learners.",
      );
      setLearners([]);
    } finally {
      setLoading(false);
    }
  }, [
    assessmentId,
    attemptsFilter,
    columns,
    debouncedSearch,
    page,
    parsedMaxScore,
    parsedMinScore,
    resultStatus,
    submittedFrom,
    submittedTo,
    view,
  ]);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await fetchScoreItemAnalysis(assessmentId);
      setItemAnalysis(response.data.items);
      setBelowFortyCount(response.data.belowFortyCount);
    } catch (loadError) {
      setItemsError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load item analysis.",
      );
      setItemAnalysis([]);
    } finally {
      setItemsLoading(false);
    }
  }, [assessmentId]);

  const loadAttempts = useCallback(async () => {
    setAttemptsLoading(true);
    setAttemptsError(null);
    try {
      const response = await fetchScoreAttemptHistory(assessmentId, {
        ...(debouncedAttemptSearch ? { learnerName: debouncedAttemptSearch } : {}),
        page: attemptsPage,
      });
      setAttempts(response.data.items);
      setAttemptsTotalPages(response.data.pageInfo.totalPages);
      setAttemptsTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setAttemptsError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load attempts.",
      );
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  }, [assessmentId, attemptsPage, debouncedAttemptSearch]);

  useEffect(() => {
    void loadLearners();
  }, [loadLearners]);

  useEffect(() => {
    if (tab === "items") void loadItems();
  }, [tab, loadItems]);

  useEffect(() => {
    if (tab === "attempts") void loadAttempts();
  }, [tab, loadAttempts]);

  const selectedMembershipIds = useMemo(() => [...selectedIds], [selectedIds]);
  const selectedAttemptIds = useMemo(
    () =>
      learners
        .filter((l) => selectedIds.has(l.membershipId) && l.latestAttemptId)
        .map((l) => l.latestAttemptId as string),
    [learners, selectedIds],
  );
  const allOnPageSelected =
    learners.length > 0 && learners.every((learner) => selectedIds.has(learner.membershipId));

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const learner of learners) next.delete(learner.membershipId);
      } else {
        for (const learner of learners) next.add(learner.membershipId);
      }
      return next;
    });
  }

  function toggleLearnerSelection(membershipId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  function clearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setResultStatus("");
    setMinScore("");
    setMaxScore("");
    setAttemptsFilter("any");
    setView("all");
    setSubmittedFrom("");
    setSubmittedTo("");
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const queued = await exportScoreReport({
        tab: "scores",
        assessmentId,
        ...(dateInputToStartIso(submittedFrom)
          ? { submittedFrom: dateInputToStartIso(submittedFrom) }
          : {}),
        ...(dateInputToEndIso(submittedTo) ? { submittedTo: dateInputToEndIso(submittedTo) } : {}),
        ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
        ...(resultStatus ? { resultStatus } : {}),
        columns,
        emailDownloadLink: false,
      });
      const completed = await pollReportRunUntilComplete(queued.data.runId);
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
            : "Unable to export CSV.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRegrade(args: { scope: "selected" | "all"; notifyLearners: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await regradeScoreAttempts(assessmentId, {
        scope: args.scope,
        notifyLearners: args.notifyLearners,
        ...(args.scope === "selected"
          ? selectedAttemptIds.length > 0
            ? { attemptIds: selectedAttemptIds }
            : { membershipIds: selectedMembershipIds }
          : {}),
      });
      setRegradeOpen(false);
      setSelectedIds(new Set());
      await loadLearners();
      if (tab === "attempts") await loadAttempts();
      if (tab === "items") await loadItems();
    } catch (regradeError) {
      setError(
        regradeError instanceof ClientApiError
          ? regradeError.message
          : regradeError instanceof Error
            ? regradeError.message
            : "Unable to regrade attempts.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyAttemptId(attemptId: string) {
    try {
      await navigator.clipboard.writeText(attemptId);
    } catch {
      /* ignore */
    }
  }

  const title = assessment?.title ?? "Assessment";
  const passMark = assessment?.passMarkPercent ?? null;
  const backHref = productScoresHref(
    assessment?.productType ?? null,
    assessment?.productId ?? null,
    courseId,
  );
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * 25 + 1;
  const showingTo = Math.min(page * 25, totalCount);
  const emptyFiltered = !loading && !error && learners.length === 0 && Boolean(assessment);

  const filterChips = useMemo(() => {
    const chips: string[] = [title];
    if (debouncedSearch) chips.push(`Name: ${debouncedSearch}`);
    if (resultStatus) chips.push(`Result: ${resultStatus.replace(/_/g, " ")}`);
    if (parsedMinScore != null) chips.push(`Min score: ${parsedMinScore}`);
    if (parsedMaxScore != null) chips.push(`Max score: ${parsedMaxScore}`);
    if (attemptsFilter !== "any") chips.push(`Attempts: ${attemptsFilter.replace(/_/g, " ")}`);
    if (view !== "all") chips.push(`View: ${view.replace(/_/g, " ")}`);
    if (submittedFrom) chips.push(`From: ${submittedFrom}`);
    if (submittedTo) chips.push(`To: ${submittedTo}`);
    if (selectedMembershipIds.length > 0) {
      chips.push(`${formatCount(selectedMembershipIds.length)} selected`);
    }
    return chips;
  }, [
    attemptsFilter,
    debouncedSearch,
    parsedMaxScore,
    parsedMinScore,
    resultStatus,
    selectedMembershipIds.length,
    submittedFrom,
    submittedTo,
    title,
    view,
  ]);

  function openCohortDrawer(mode: CohortDrawerMode) {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  if (loading && !assessment && !error) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-24">
        <ProgressScoreReportTabs active="scores" />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-24">
      <ProgressScoreReportTabs active="scores" />

      <nav
        className="flex items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin/reports/progress-score" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <Link href="/admin/reports/progress-score/scores" className="hover:text-[var(--admin-primary)]">
          Progress & Score
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <Link href={backHref} className="hover:text-[var(--admin-primary)]">
          Scores
        </Link>
        {assessment?.productTitle ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <Link
              href={backHref}
              className="max-w-[160px] truncate hover:text-[var(--admin-primary)]"
            >
              {assessment.productTitle}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate text-[var(--admin-on-surface)]">{title}</span>
      </nav>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All assessments
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
              {title}
            </h1>
            <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-primary)]">
              {humanizeType(assessment?.assessmentType ?? "quiz")}
            </span>
          </div>
          <p className="mb-3 text-base text-[var(--admin-on-surface-variant)]">
            {[courseTitle ?? assessment?.productTitle, assessment?.lessonTitle]
              .filter(Boolean)
              .join(" · ") || "Assessment scores"}
          </p>
          {passMark != null ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-1">
              <Check className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface)]">
                Pass mark {formatPct(passMark)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className={`${ghostButtonClassName} inline-flex items-center gap-2`}
              onClick={() => setColumnsOpen((o) => !o)}
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Columns
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg">
                {SCORE_LEARNER_COLUMN_OPTIONS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={columns.includes(col.key)}
                      onChange={() => {
                        setColumns((prev) =>
                          prev.includes(col.key)
                            ? prev.filter((k) => k !== col.key)
                            : [...prev, col.key],
                        );
                      }}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex items-center gap-2`}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href="/admin/assessments"
            className={`${ghostButtonClassName} inline-flex items-center gap-2`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open assessment
          </Link>
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex items-center gap-2`}
            onClick={() => openCohortDrawer("group")}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Cohort actions
          </button>
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex items-center gap-2`}
            onClick={() => setRegradeOpen(true)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Regrade
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">{error}</span>
          </div>
          <button type="button" className={ghostButtonClassName} onClick={() => void loadLearners()}>
            Retry
          </button>
        </div>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5 md:col-span-2">
            <div className="mb-6 flex items-start justify-between">
              <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Avg Score
              </span>
              <span className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-primary)]">
                {formatPct(summary.avgScorePct)}
              </span>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <div
                className="absolute inset-y-0 left-0 bg-[var(--admin-primary)]"
                style={{ width: `${Math.max(0, Math.min(100, summary.avgScorePct ?? 0))}%` }}
              />
              {passMark != null ? (
                <div
                  className="absolute inset-y-0 z-10 w-0.5 bg-[var(--admin-on-surface)]"
                  style={{ left: `${passMark}%` }}
                />
              ) : null}
            </div>
            <div className="relative mt-2 flex justify-between font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              <span>0%</span>
              {passMark != null ? (
                <span className="absolute" style={{ left: `calc(${passMark}% - 24px)` }}>
                  {formatPct(passMark)} Pass
                </span>
              ) : null}
              <span>100%</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <span className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Pass Rate
            </span>
            <div>
              <div className="mb-1 text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {formatPct(summary.passRatePct)}
              </div>
              <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatCount(summary.passedCount)}/{formatCount(summary.learnerCount)} Passed
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <span className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Attempts
            </span>
            <div>
              <div className="mb-1 text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                {formatCount(summary.attemptCount)}
              </div>
              <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {summary.attemptsPerLearner != null
                  ? `${summary.attemptsPerLearner} avg / learner`
                  : "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <span className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Median Time
            </span>
            <div className="mt-auto text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
              {summary.medianTimeLabel ?? "—"}
            </div>
          </div>

          <button
            type="button"
            className="flex flex-col justify-between rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-5 text-left transition-colors hover:brightness-110"
            onClick={() => {
              setView("ungraded");
              setTab("learners");
              setPage(1);
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
              <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--admin-warning)]">
                Ungraded
              </span>
            </div>
            <div>
              <div className="mb-1 text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-warning)]">
                {formatCount(summary.ungradedCount)}
              </div>
              <div className="font-mono text-[11px] text-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)]">
                Require manual review
              </div>
            </div>
          </button>
        </div>
      ) : null}

      <div className="flex gap-8 border-b border-[var(--admin-border)]" role="tablist">
        {(
          [
            { id: "learners" as const, label: `Learners (${formatCount(summary?.learnerCount ?? totalCount)})` },
            { id: "items" as const, label: "Item analysis" },
            {
              id: "attempts" as const,
              label: `Attempts (${formatCount(summary?.attemptCount ?? attemptsTotalCount)})`,
            },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={[
              "pb-3 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors",
              tab === entry.id
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "learners" ? (
        <div className="flex min-h-[480px] flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className={fieldClassName}
                value={submittedFrom}
                onChange={(event) => {
                  setSubmittedFrom(event.target.value);
                  setPage(1);
                }}
                aria-label="Submitted from"
              />
              <input
                type="date"
                className={fieldClassName}
                value={submittedTo}
                onChange={(event) => {
                  setSubmittedTo(event.target.value);
                  setPage(1);
                }}
                aria-label="Submitted to"
              />
              <Select
                value={resultStatus}
                onValueChange={(value) => {
                  setResultStatus(value as "" | ScoreLearnerResultStatus);
                  setPage(1);
                }}
                options={RESULT_OPTIONS}
                className={selectClassName}
                ariaLabel="Result filter"
              />
              <div className="flex h-9 items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 focus-within:border-[var(--admin-primary)]">
                <span className="border-r border-[var(--admin-border)] pr-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  Score
                </span>
                <input
                  className="h-full w-12 border-none bg-transparent p-0 text-center font-mono text-[11px] text-[var(--admin-on-surface)] focus:ring-0"
                  placeholder="Min"
                  value={minScore}
                  onChange={(event) => {
                    setMinScore(event.target.value);
                    setPage(1);
                  }}
                />
                <span className="px-1 text-[var(--admin-on-surface-variant)]">–</span>
                <input
                  className="h-full w-12 border-none bg-transparent p-0 text-center font-mono text-[11px] text-[var(--admin-on-surface)] focus:ring-0"
                  placeholder="Max"
                  value={maxScore}
                  onChange={(event) => {
                    setMaxScore(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                value={attemptsFilter}
                onValueChange={(value) => {
                  setAttemptsFilter(value as ScoreAttemptsFilter);
                  setPage(1);
                }}
                options={ATTEMPTS_FILTER_OPTIONS}
                className={selectClassName}
                ariaLabel="Attempts filter"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                <span className="mr-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  Views:
                </span>
                {VIEW_TABS.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    className={[
                      "rounded-sm px-2 py-0.5 font-mono text-[11px] transition-colors",
                      view === entry.value
                        ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                        : "border border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                    ].join(" ")}
                    onClick={() => {
                      setView(entry.value);
                      setPage(1);
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className={`${fieldClassName} w-48 pl-8`}
                  placeholder="Search learner…"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>
            </div>
          </div>

          {selectedMembershipIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
              <p className="font-mono text-sm tabular-nums text-[var(--admin-on-surface)]">
                <span className="mr-2 rounded-sm bg-[var(--admin-primary)] px-2 py-0.5 font-bold text-[var(--admin-on-primary)]">
                  {formatCount(selectedMembershipIds.length)} selected
                </span>
                of {formatCount(totalCount)} learners
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => openCohortDrawer("group")}
                >
                  Create group
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => openCohortDrawer("message")}
                >
                  Message
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => setRegradeOpen(true)}
                >
                  Regrade
                </button>
                <button
                  type="button"
                  className={`${ghostButtonClassName} inline-flex items-center gap-1`}
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          {emptyFiltered ? (
            <div className="relative flex min-h-[360px] flex-1 flex-col items-center justify-center overflow-hidden px-8 py-16 text-center">
              <SearchX
                className="mb-6 h-16 w-16 text-[var(--admin-on-surface-variant)] transition-colors"
                aria-hidden="true"
              />
              <h2 className="mb-3 text-xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-2xl">
                No learners matched these filters.
              </h2>
              <p className="mb-8 max-w-md text-base text-[var(--admin-on-surface-variant)]">
                Adjust your filters or search terms to see learner results.
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className={`${ghostButtonClassName} inline-flex h-11 items-center gap-2 border-2 border-[var(--admin-on-surface)] px-8 uppercase tracking-[0.12em] hover:bg-[var(--admin-on-surface)] hover:text-[var(--admin-surface)]`}
                  onClick={clearFilters}
                >
                  Clear all filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      <th className="w-12 p-4 text-center font-normal">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          aria-label="Select all on page"
                        />
                      </th>
                      <th className="p-4 font-normal">Learner</th>
                      <th className="w-32 p-4 font-normal">Result</th>
                      <th className="w-48 p-4 font-normal">Score</th>
                      <th className="w-24 p-4 text-right font-normal">Attempts</th>
                      <th className="w-28 p-4 text-right font-normal">Answered</th>
                      <th className="w-32 p-4 font-normal">Time spent</th>
                      <th className="w-40 p-4 font-normal">Submitted on</th>
                      <th className="w-12 p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} aria-hidden="true">
                            <td className="p-4" colSpan={9}>
                              <Shimmer className="h-10 w-full" />
                            </td>
                          </tr>
                        ))
                      : learners.map((learner) => {
                          const selected = selectedIds.has(learner.membershipId);
                          const rail =
                            learner.resultStatus === "fail"
                              ? "border-l-2 border-l-[var(--admin-danger)]"
                              : learner.resultStatus === "pending"
                                ? "border-l-2 border-l-[var(--admin-warning)]"
                                : "border-l-2 border-l-transparent";
                          return (
                            <tr
                              key={learner.membershipId}
                              className={`group relative border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)] ${rail}`}
                            >
                              <td className="p-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleLearnerSelection(learner.membershipId)}
                                  aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                                  className="opacity-0 transition-opacity group-hover:opacity-100 checked:opacity-100 focus:opacity-100"
                                />
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[10px] font-semibold"
                                    aria-hidden="true"
                                  >
                                    {learnerInitials(learner)}
                                  </div>
                                  <div className="min-w-0">
                                    <Link
                                      href={`/admin/members/${learner.membershipId}`}
                                      className="block truncate font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                                    >
                                      {learner.learnerName ?? "Unknown"}
                                    </Link>
                                    <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {learner.email ?? "—"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${resultChipClass(learner.resultStatus)}`}
                                >
                                  {learner.resultStatus.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="p-4">
                                {learner.resultStatus === "pending" && learner.scorePct == null ? (
                                  <span className="font-mono text-[12px] italic text-[var(--admin-warning)]">
                                    Awaiting grading
                                  </span>
                                ) : learner.scorePct == null ? (
                                  <span className="font-mono text-[var(--admin-on-surface-variant)]">
                                    —
                                  </span>
                                ) : (
                                  <div
                                    className={`flex items-center gap-3 font-mono text-[13px] ${scoreBarTone(learner.resultStatus).split(" ").slice(1).join(" ")}`}
                                  >
                                    <span className="w-10 text-right tabular-nums">
                                      {formatPct(learner.scorePct)}
                                    </span>
                                    <ScoreBar
                                      value={learner.scorePct}
                                      passMark={passMark}
                                      toneClass={scoreBarTone(learner.resultStatus)}
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-right font-mono tabular-nums text-[var(--admin-on-surface)]">
                                <span className="inline-flex items-center justify-end gap-1">
                                  {learner.attemptCount}
                                  {learner.attemptCount > 1 ? (
                                    <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                      ×{learner.attemptCount}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono tabular-nums">
                                {learner.answeredCount}
                                {learner.questionCount != null
                                  ? `/${learner.questionCount}`
                                  : ""}
                              </td>
                              <td className="p-4 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                                {formatDuration(learner.durationSeconds)}
                              </td>
                              <td className="p-4 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                                {formatSubmitted(learner.submittedAt, learner.startedAt)}
                              </td>
                              <td className="relative p-4 text-right">
                                <button
                                  type="button"
                                  className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                                  aria-label="Row actions"
                                  onClick={() =>
                                    setRowMenuId((id) =>
                                      id === learner.membershipId ? null : learner.membershipId,
                                    )
                                  }
                                >
                                  <MoreVertical className="h-5 w-5" aria-hidden="true" />
                                </button>
                                {rowMenuId === learner.membershipId ? (
                                  <div className="absolute right-4 z-10 mt-1 w-44 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                    <Link
                                      href={`/admin/members/${learner.membershipId}`}
                                      className="block px-3 py-2 text-left text-xs hover:bg-[var(--admin-surface-high)]"
                                    >
                                      Open profile
                                    </Link>
                                    {learner.latestAttemptId ? (
                                      <button
                                        type="button"
                                        className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--admin-surface-high)]"
                                        onClick={() => {
                                          void copyAttemptId(learner.latestAttemptId!);
                                          setRowMenuId(null);
                                        }}
                                      >
                                        Copy attempt ID
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--admin-surface-high)]"
                                      onClick={() => {
                                        setSelectedIds(new Set([learner.membershipId]));
                                        setRegradeOpen(true);
                                        setRowMenuId(null);
                                      }}
                                    >
                                      Regrade attempt
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                <span>
                  Showing {showingFrom}–{showingTo} of {formatCount(totalCount)} learners
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--admin-border)] disabled:opacity-40"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="tabular-nums">
                    {page}
                    {totalPages > 0 ? ` / ${totalPages}` : ""}
                  </span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--admin-border)] disabled:opacity-40"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "items" ? (
        <div className="flex flex-col gap-6">
          {itemsError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
              <span className="text-sm text-[var(--admin-danger)]">{itemsError}</span>
              <button type="button" className={ghostButtonClassName} onClick={() => void loadItems()}>
                Retry
              </button>
            </div>
          ) : null}

          {belowFortyCount > 0 ? (
            <div className="flex items-start gap-4 border border-[var(--admin-warning)] bg-[var(--admin-surface-low)] p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]" />
              <div>
                <p className="mb-1 font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--admin-warning)]">
                  Attention Required
                </p>
                <p className="text-[var(--admin-on-surface)]">
                  {belowFortyCount} question{belowFortyCount === 1 ? "" : "s"} fall below 40% correct
                  — review wording or coverage.
                </p>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  <th className="w-12 px-4 py-4 text-center font-normal">#</th>
                  <th className="px-4 py-4 font-normal">Question</th>
                  <th className="w-32 px-4 py-4 font-normal">Type</th>
                  <th className="w-48 px-4 py-4 font-normal">Correct Rate</th>
                  <th className="w-24 px-4 py-4 text-right font-normal">Avg Time</th>
                  <th className="w-32 px-4 py-4 text-right font-normal">Disc. Index</th>
                  <th className="w-12 px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {itemsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4" colSpan={7}>
                        <Shimmer className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : itemAnalysis.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-[var(--admin-on-surface-variant)]"
                    >
                      No item analysis data yet. Learners need scored attempts first.
                    </td>
                  </tr>
                ) : (
                  itemAnalysis.map((item) => {
                    const expanded = expandedItemId === item.assessmentItemId;
                    const low =
                      item.correctRatePct != null && item.correctRatePct < 40;
                    const discLow =
                      item.discrimination != null && item.discrimination < 0.2;
                    return (
                      <Fragment key={item.assessmentItemId}>
                        <tr
                          className="cursor-pointer transition-colors hover:bg-[var(--admin-surface-high)]"
                          onClick={() =>
                            setExpandedItemId(expanded ? null : item.assessmentItemId)
                          }
                        >
                          <td className="px-4 py-4 text-center font-mono text-[var(--admin-on-surface)]">
                            Q{item.position + 1}
                          </td>
                          <td className="px-4 py-4">
                            <span className="line-clamp-1 text-[var(--admin-on-surface)]">
                              {item.stem}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                              {humanizeType(item.itemTypeKey)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`font-mono text-[13px] tabular-nums ${low ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]"}`}
                              >
                                {formatPct(item.correctRatePct)}
                              </span>
                              <div className="relative h-1 flex-1 bg-[var(--admin-surface-low)]">
                                <div
                                  className={`absolute inset-y-0 left-0 ${low ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-primary)]"}`}
                                  style={{
                                    width: `${Math.max(0, Math.min(100, item.correctRatePct ?? 0))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                            {item.avgTimeLabel ?? "—"}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[13px]">
                            <span
                              className={
                                discLow
                                  ? "border-b border-dashed border-[var(--admin-warning)] text-[var(--admin-warning)]"
                                  : "text-[var(--admin-on-surface)]"
                              }
                              title={discLow ? "Low discrimination" : undefined}
                            >
                              {item.discrimination == null
                                ? "—"
                                : item.discrimination.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center text-[var(--admin-on-surface-variant)]">
                            <ChevronDown
                              className={`mx-auto h-5 w-5 transition-transform ${expanded ? "rotate-180 text-[var(--admin-primary)]" : ""}`}
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                        {expanded ? (
                          <tr
                            className={`bg-[var(--admin-surface-low)] ${low ? "border-l-4 border-l-[var(--admin-warning)]" : "border-l-4 border-l-[var(--admin-primary)]"}`}
                          >
                            <td className="p-6" colSpan={7}>
                              <div className="max-w-3xl">
                                <p className="mb-6 text-lg leading-relaxed text-[var(--admin-on-surface)]">
                                  {item.stem}
                                </p>
                                {item.options.length === 0 ? (
                                  <p className="text-sm italic text-[var(--admin-on-surface-variant)]">
                                    No option-level breakdown for this item type.
                                  </p>
                                ) : (
                                  <div className="space-y-4 font-mono text-[13px]">
                                    {item.options.map((option, index) => {
                                      const letter = String.fromCharCode(65 + index);
                                      const mostWrong =
                                        !option.isCorrect &&
                                        item.mostWrongOption === option.label;
                                      return (
                                        <div
                                          key={option.optionId}
                                          className="flex items-center gap-4"
                                        >
                                          <div
                                            className={[
                                              "flex h-8 w-8 shrink-0 items-center justify-center border",
                                              option.isCorrect
                                                ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                                                : mostWrong
                                                  ? "border-[var(--admin-warning)] text-[var(--admin-warning)]"
                                                  : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]",
                                            ].join(" ")}
                                          >
                                            {letter}
                                          </div>
                                          <div className="flex-1">
                                            <div className="mb-1 flex justify-between gap-4">
                                              <span
                                                className={
                                                  option.isCorrect
                                                    ? "font-bold text-[var(--admin-primary)]"
                                                    : mostWrong
                                                      ? "text-[var(--admin-warning)]"
                                                      : "text-[var(--admin-on-surface-variant)]"
                                                }
                                              >
                                                {option.label}
                                                {option.isCorrect ? " (Correct)" : ""}
                                                {mostWrong ? " (Most chosen wrong)" : ""}
                                              </span>
                                              <span
                                                className={
                                                  option.isCorrect
                                                    ? "font-bold text-[var(--admin-primary)]"
                                                    : mostWrong
                                                      ? "text-[var(--admin-warning)]"
                                                      : "text-[var(--admin-on-surface-variant)]"
                                                }
                                              >
                                                {formatPct(option.sharePct)}
                                              </span>
                                            </div>
                                            <div className="h-2 w-full bg-[var(--admin-surface-high)]">
                                              <div
                                                className={`h-full ${
                                                  option.isCorrect
                                                    ? "bg-[var(--admin-primary)]"
                                                    : mostWrong
                                                      ? "bg-[var(--admin-warning)]"
                                                      : "bg-[var(--admin-outline)]"
                                                }`}
                                                style={{ width: `${option.sharePct}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "attempts" ? (
        <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                className={`${fieldClassName} w-64 pl-8`}
                placeholder="Search attempts…"
                value={attemptSearch}
                onChange={(event) => setAttemptSearch(event.target.value)}
              />
            </div>
            <button
              type="button"
              className={`${ghostButtonClassName} inline-flex items-center gap-2`}
              disabled={busy}
              onClick={() => void handleExport()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>
          </div>

          {attemptsError ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--admin-danger)]">
              <span>{attemptsError}</span>
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => void loadAttempts()}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  <th className="px-6 py-4 font-normal">Attempt ID</th>
                  <th className="px-6 py-4 font-normal">Learner</th>
                  <th className="px-6 py-4 font-normal">#</th>
                  <th className="px-6 py-4 font-normal">Score</th>
                  <th className="px-6 py-4 font-normal">Timing</th>
                  <th className="px-6 py-4 font-normal">Flags</th>
                  <th className="px-6 py-4 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {attemptsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4" colSpan={7}>
                        <Shimmer className="h-12 w-full" />
                      </td>
                    </tr>
                  ))
                ) : attempts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-[var(--admin-on-surface-variant)]"
                    >
                      No attempts recorded for this assessment yet.
                    </td>
                  </tr>
                ) : (
                  attempts.map((attempt) => (
                    <tr
                      key={attempt.attemptId}
                      className="group transition-colors hover:bg-[var(--admin-surface-high)]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            #{attempt.attemptId.slice(0, 8)}
                          </span>
                          <button
                            type="button"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => void copyAttemptId(attempt.attemptId)}
                            aria-label="Copy attempt ID"
                          >
                            <Copy className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[10px]"
                            aria-hidden="true"
                          >
                            {learnerInitials(attempt)}
                          </div>
                          <Link
                            href={`/admin/members/${attempt.membershipId}`}
                            className="font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                          >
                            {attempt.learnerName ?? "Unknown"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[var(--admin-on-surface-variant)]">
                        {attempt.attemptNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xl font-semibold tabular-nums ${
                              attempt.resultStatus === "pass"
                                ? "text-[var(--admin-primary)]"
                                : attempt.resultStatus === "fail"
                                  ? "text-[var(--admin-warning)]"
                                  : "text-[var(--admin-on-surface-variant)]"
                            }`}
                          >
                            {formatPct(attempt.scorePct)}
                          </span>
                          <span
                            className={`inline-flex border px-2 py-0.5 font-mono text-[10px] uppercase ${resultChipClass(attempt.resultStatus)}`}
                          >
                            {attempt.resultStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {attempt.answeredCount}
                          {attempt.questionCount != null ? `/${attempt.questionCount}` : ""}{" "}
                          Answered
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex w-36 flex-col gap-1 font-mono text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-[var(--admin-on-surface-variant)]">Start:</span>
                            <span>{formatClock(attempt.startedAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--admin-on-surface-variant)]">Sub:</span>
                            <span>{formatClock(attempt.submittedAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--admin-on-surface-variant)]">Dur:</span>
                            <span>{formatDuration(attempt.durationSeconds)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {attempt.flags.length === 0 ? (
                            <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              —
                            </span>
                          ) : (
                            attempt.flags.map((flag) => (
                              <span
                                key={flag}
                                className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface)]"
                              >
                                {flag}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {attempt.resultStatus === "pending" ? (
                          <Link
                            href={`/admin/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attempt.attemptId}`}
                            className={`${primaryButtonClassName} inline-flex items-center gap-1`}
                          >
                            Grade Now
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/reports/progress-score/scores/quizzes/${assessmentId}/attempts/${attempt.attemptId}`}
                            className={`${ghostButtonClassName} inline-flex items-center gap-1 border border-[var(--admin-on-surface)]`}
                          >
                            Review
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
            <span>
              Showing{" "}
              {attemptsTotalCount === 0 ? 0 : (attemptsPage - 1) * 25 + 1}–
              {Math.min(attemptsPage * 25, attemptsTotalCount)} of{" "}
              {formatCount(attemptsTotalCount)} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={attemptsPage <= 1 || attemptsLoading}
                onClick={() => setAttemptsPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="tabular-nums">
                {attemptsPage}
                {attemptsTotalPages > 0 ? ` / ${attemptsTotalPages}` : ""}
              </span>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={attemptsPage >= attemptsTotalPages || attemptsLoading}
                onClick={() => setAttemptsPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <RegradeModal
        open={regradeOpen}
        assessmentTitle={title}
        selectedCount={selectedAttemptIds.length || selectedMembershipIds.length}
        answerKeyVersion="current"
        busy={busy}
        onClose={() => setRegradeOpen(false)}
        onConfirm={(args) => void handleRegrade(args)}
      />

      <CohortActionsDrawer
        open={drawerOpen}
        initialMode={drawerMode}
        audience={{
          sourceKind: "scores",
          assessmentId,
          assessmentTitle: title,
          productTitle: assessment?.productTitle ?? courseTitle,
          matchCount: selectedMembershipIds.length > 0 ? selectedMembershipIds.length : totalCount,
          ...(selectedMembershipIds.length > 0
            ? { membershipIds: selectedMembershipIds }
            : {}),
          filterChips,
          suggestedGroupName: `${view !== "all" ? view.replace(/_/g, " ") : "Cohort"} — ${title}`,
          audienceFilters: {
            ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
            ...(resultStatus ? { resultStatus } : {}),
            ...(parsedMinScore != null ? { minScore: parsedMinScore } : {}),
            ...(parsedMaxScore != null ? { maxScore: parsedMaxScore } : {}),
            ...(attemptsFilter !== "any" ? { attemptsFilter } : {}),
            ...(view !== "all" ? { view } : {}),
            ...(dateInputToStartIso(submittedFrom)
              ? { submittedFrom: dateInputToStartIso(submittedFrom) }
              : {}),
            ...(dateInputToEndIso(submittedTo)
              ? { submittedTo: dateInputToEndIso(submittedTo) }
              : {}),
          },
        }}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => void loadLearners()}
      />
    </div>
  );
}
