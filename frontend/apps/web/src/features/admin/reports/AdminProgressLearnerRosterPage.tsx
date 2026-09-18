"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
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
  exportProgressReport,
  fetchProgressLearners,
  PROGRESS_LEARNER_COLUMN_OPTIONS,
  type ProductPublishStatus,
  type ProgressCompletionBandKey,
  type ProgressCurriculumStrip,
  type ProgressLearnerActivityStatus,
  type ProgressLearnerColumnKey,
  type ProgressLearnerItem,
  type ProgressLearnerRosterProduct,
  type ProgressLearnerRosterSummary,
  type ProgressLearnerView,
  type ProgressProductType,
} from "./admin-progress-score-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { CohortActionsDrawer, type CohortDrawerMode } from "./CohortActionsDrawer";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";

const ENROLLED_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All types" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "complimentary", label: "Complimentary" },
  { value: "manual", label: "Manual" },
  { value: "offline", label: "Offline" },
  { value: "trial", label: "Trial" },
];

const COMPLETION_BAND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All bands" },
  { value: "not_started", label: "Not started" },
  { value: "early", label: "Early (1–24%)" },
  { value: "in_progress", label: "In progress (25–74%)" },
  { value: "nearly_done", label: "Nearly done (75–99%)" },
  { value: "complete", label: "Complete" },
];

const ACTIVITY_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any activity" },
  { value: "active", label: "Active" },
  { value: "stalled", label: "Stalled" },
  { value: "not_started", label: "Not started" },
];

const VIEW_TABS: Array<{ key: ProgressLearnerView; label: string }> = [
  { key: "all", label: "All learners" },
  { key: "stalled", label: "Stalled" },
  { key: "not_started", label: "Not started" },
  { key: "nearly_done", label: "Nearly done" },
];

const PAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
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

function formatRelativeActivity(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
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
  return date.toLocaleDateString();
}

function formatAbsoluteDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function productNoun(productType: ProgressProductType): string {
  if (productType === "course") return "courses";
  if (productType === "test_series") return "test series";
  if (productType === "bundle") return "bundles";
  return "subscriptions";
}

function productTypeLabel(productType: ProgressProductType): string {
  if (productType === "course") return "Course";
  if (productType === "test_series") return "Test series";
  if (productType === "bundle") return "Bundle";
  return "Subscription";
}

function publishStatusChipClass(status: ProductPublishStatus): string {
  if (status === "DRAFT") {
    return "border-[var(--admin-warning)] text-[var(--admin-warning)]";
  }
  if (status === "ARCHIVED") {
    return "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]";
  }
  if (status === "REVIEW") {
    return "border-[var(--admin-primary)] text-[var(--admin-primary)]";
  }
  return "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]";
}

function activityStatusChipClass(status: ProgressLearnerActivityStatus): string {
  if (status === "stalled") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (status === "not_started") {
    return "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]";
  }
  return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
}

function activityStatusLabel(status: ProgressLearnerActivityStatus): string {
  if (status === "stalled") return "Stalled";
  if (status === "not_started") return "Not started";
  return "Active";
}

function learnerInitials(learner: ProgressLearnerItem): string {
  const source = learner.learnerName?.trim() || learner.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function openProductHref(productType: ProgressProductType): string {
  if (productType === "course") return "/admin/courses";
  return "/admin/reports/progress-score/progress";
}

function isExpiringWithin30Days(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = date.getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
}

function LearnerRosterSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading learner roster">
      <div className="space-y-2">
        <Shimmer className="h-3 w-72 max-w-full" />
        <Shimmer className="h-3 w-40" />
      </div>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Shimmer className="h-6 w-20" />
            <Shimmer className="h-6 w-24" />
          </div>
          <Shimmer className="h-9 w-96 max-w-full" />
          <Shimmer className="h-4 w-64" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-10 w-28" />
          <Shimmer className="h-10 w-32" />
          <Shimmer className="h-10 w-32" />
          <Shimmer className="h-10 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="space-y-4 bg-[var(--admin-surface)] p-6 md:col-span-2">
          <Shimmer className="h-3 w-36" />
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-[3px] w-full" />
        </div>
        <div className="space-y-4 bg-[var(--admin-surface)] p-6">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-7 w-16" />
        </div>
        <div className="space-y-4 bg-[var(--admin-surface)] p-6">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-7 w-12" />
          <Shimmer className="h-3 w-32" />
        </div>
        <div className="space-y-4 bg-[var(--admin-surface)] p-6">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-7 w-12" />
          <Shimmer className="h-7 w-12" />
        </div>
      </div>
      <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <Shimmer className="mb-4 h-8 w-full" />
        <Shimmer className="h-3 w-72" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Shimmer className="h-9 w-28" />
        <Shimmer className="h-9 w-28" />
        <Shimmer className="h-9 w-28" />
        <Shimmer className="h-9 w-28" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Shimmer className="h-9 w-52" />
        <Shimmer className="h-9 w-36" />
        <Shimmer className="h-9 w-36" />
        <Shimmer className="h-9 w-40" />
      </div>
      <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
          <Shimmer className="h-3 w-full max-w-4xl" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-b-0"
          >
            <Shimmer className="col-span-1 h-4 w-4" />
            <div className="col-span-3 flex items-center gap-3">
              <Shimmer className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-40" />
              </div>
            </div>
            <Shimmer className="col-span-2 h-3 w-full" />
            <Shimmer className="col-span-2 h-3 w-full" />
            <Shimmer className="col-span-2 h-3 w-20" />
            <Shimmer className="col-span-1 h-5 w-16" />
            <Shimmer className="col-span-1 h-4 w-4 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CurriculumStrip({
  curriculum,
  productType,
}: {
  curriculum: ProgressCurriculumStrip;
  productType: ProgressProductType;
}) {
  if (productType !== "course" || curriculum.lessons.length === 0) {
    return null;
  }

  const dropOffId = curriculum.steepestDropOff?.lessonId ?? null;

  return (
    <section className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        Curriculum completion
      </h2>
      <div
        className="flex h-16 items-end gap-0.5"
        role="img"
        aria-label="Lesson completion funnel by curriculum order"
      >
        {curriculum.lessons.map((lesson) => {
          const isDropOff = lesson.lessonId === dropOffId;
          const heightPct = Math.max(4, Math.min(100, lesson.completionPct));
          return (
            <div
              key={lesson.lessonId}
              className="group relative min-w-[3px] flex-1"
              title={`${lesson.title}: ${formatPct(lesson.completionPct)} (${formatCount(lesson.completedCount)} learners)`}
            >
              <div
                className={[
                  "w-full rounded-t-sm transition-colors",
                  isDropOff
                    ? "bg-[var(--admin-warning)]"
                    : "bg-[var(--admin-primary)] group-hover:brightness-110",
                ].join(" ")}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      {curriculum.steepestDropOff ? (
        <p className="mt-4 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
          Steepest drop-off:{" "}
          <span className="text-[var(--admin-warning)]">{curriculum.steepestDropOff.title}</span> (
          {formatPct(curriculum.steepestDropOff.completionPct)} completion, −
          {formatPct(curriculum.steepestDropOff.dropPct)} vs prior lesson)
        </p>
      ) : (
        <p className="mt-4 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
          No significant drop-off detected across lessons.
        </p>
      )}
    </section>
  );
}

function SummaryBand({
  summary,
  onStalledClick,
}: {
  summary: ProgressLearnerRosterSummary;
  onStalledClick: () => void;
}) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-6 md:col-span-2">
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Average completion
        </p>
        <div>
          <p className="mb-3 font-mono text-[32px] leading-none font-bold tabular-nums text-[var(--admin-on-surface)]">
            {formatPct(summary.avgCompletionPct)}
          </p>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, summary.avgCompletionPct ?? 0))}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-6">
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Completed
        </p>
        <p className="font-mono text-[28px] leading-none font-bold tabular-nums text-[var(--admin-success)]">
          {formatCount(summary.completedCount)}
        </p>
        <p className="mt-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
          learners at 100%
        </p>
      </div>

      <button
        type="button"
        onClick={onStalledClick}
        className="group flex flex-col justify-between bg-[var(--admin-surface)] p-6 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]"
      >
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-warning)]">
          Stalled
        </p>
        <p className="font-mono text-[28px] leading-none font-bold tabular-nums text-[var(--admin-warning)]">
          {formatCount(summary.stalledCount)}
        </p>
        <p className="mt-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)] group-hover:text-[var(--admin-on-surface)]">
          no recent activity · click to filter
        </p>
      </button>

      <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-6">
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Not started
        </p>
        <p className="font-mono text-[28px] leading-none font-bold tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.notStartedCount)}
        </p>
        <div className="mt-4 border-t border-[var(--admin-border)] pt-4">
          <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            Expiring &lt;30d
          </p>
          <p className="font-mono text-[20px] leading-none font-bold tabular-nums text-[var(--admin-warning)]">
            {formatCount(summary.expiringWithin30dCount)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminProgressLearnerRosterPage({
  productType,
  productId,
}: {
  productType: ProgressProductType;
  productId: string;
}) {
  const router = useRouter();
  const searchId = useId();
  const columnsPanelId = useId();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [product, setProduct] = useState<ProgressLearnerRosterProduct | null>(null);
  const [summary, setSummary] = useState<ProgressLearnerRosterSummary | null>(null);
  const [curriculum, setCurriculum] = useState<ProgressCurriculumStrip>({
    lessons: [],
    steepestDropOff: null,
  });
  const [learners, setLearners] = useState<ProgressLearnerItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [view, setView] = useState<ProgressLearnerView>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [enrolledType, setEnrolledType] = useState("");
  const [completionBand, setCompletionBand] = useState<ProgressCompletionBandKey | "">("");
  const [activityStatus, setActivityStatus] = useState<ProgressLearnerActivityStatus | "">("");

  const [progressColumns, setProgressColumns] = useState<ProgressLearnerColumnKey[]>(
    PROGRESS_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<CohortDrawerMode>("group");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchProgressLearners(productType, productId, {
        ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
        ...(enrolledType ? { enrolledType } : {}),
        view,
        ...(completionBand ? { completionBand } : {}),
        ...(activityStatus ? { activityStatus } : {}),
        sortBy: "last_activity_at",
        sortDir: "desc",
        columns: progressColumns,
        page,
        limit: pageSize,
      });
      setProduct(response.data.product);
      setSummary(response.data.summary);
      setCurriculum(response.data.curriculum);
      setLearners(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setProduct(null);
      setSummary(null);
      setCurriculum({ lessons: [], steepestDropOff: null });
      setLearners([]);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load learner roster.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    activityStatus,
    completionBand,
    debouncedSearch,
    enrolledType,
    page,
    pageSize,
    productId,
    productType,
    progressColumns,
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilters = Boolean(
    debouncedSearch || enrolledType || completionBand || activityStatus || view !== "all",
  );

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);

  const selectedMembershipIds = useMemo(() => [...selectedIds], [selectedIds]);

  const allOnPageSelected =
    learners.length > 0 && learners.every((learner) => selectedIds.has(learner.membershipId));

  function clearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setEnrolledType("");
    setCompletionBand("");
    setActivityStatus("");
    setView("all");
    setPage(1);
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) {
        for (const learner of learners) {
          next.delete(learner.membershipId);
        }
      } else {
        for (const learner of learners) {
          next.add(learner.membershipId);
        }
      }
      return next;
    });
  }

  function toggleLearnerSelection(membershipId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) {
        next.delete(membershipId);
      } else {
        next.add(membershipId);
      }
      return next;
    });
  }

  function navigateToLearnerDetail(enrollmentId: string) {
    router.push(
      `/admin/reports/progress-score/progress/${productType}/${productId}/learners/${enrollmentId}`,
    );
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportProgressReport({
        productType,
        productId,
        ...(productType === "course" ? { courseId: productId } : {}),
        ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
        ...(enrolledType ? { enrolledType } : {}),
        columns: progressColumns,
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

  const noun = productNoun(productType);
  const typeLabel = productTypeLabel(productType);
  const productTitle = product?.title ?? "…";
  const emptyFiltered = !loading && !error && learners.length === 0 && Boolean(product);

  const filterChips = useMemo(() => {
    const chips: string[] = [`${typeLabel}: ${productTitle}`];
    if (debouncedSearch) chips.push(`Name: ${debouncedSearch}`);
    if (enrolledType) chips.push(`Type: ${enrolledType}`);
    if (view !== "all") chips.push(`View: ${view.replace(/_/g, " ")}`);
    if (completionBand) chips.push(`Band: ${completionBand.replace(/_/g, " ")}`);
    if (activityStatus) chips.push(`Activity: ${activityStatus.replace(/_/g, " ")}`);
    if (selectedMembershipIds.length > 0) {
      chips.push(`${formatCount(selectedMembershipIds.length)} selected`);
    }
    return chips;
  }, [
    activityStatus,
    completionBand,
    debouncedSearch,
    enrolledType,
    productTitle,
    selectedMembershipIds.length,
    typeLabel,
    view,
  ]);

  function openCohortDrawer(mode: CohortDrawerMode) {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  if (loading && !product && !error) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
        <ProgressScoreReportTabs active="progress" />
        <LearnerRosterSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
      <ProgressScoreReportTabs active="progress" />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="font-mono text-[13px] text-[var(--admin-on-surface)]">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={`${primaryButtonClassName} h-9 gap-2 bg-[var(--admin-warning)] text-[var(--admin-on-warning)] hover:brightness-110`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <nav
        aria-label="Breadcrumb"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
              Reports
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/admin/reports/progress-score"
              className="hover:text-[var(--admin-primary)]"
            >
              Progress &amp; Score
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/admin/reports/progress-score/progress"
              className="hover:text-[var(--admin-primary)]"
            >
              Progress
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>{typeLabel}</li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--admin-on-surface)]">{productTitle}</li>
        </ol>
      </nav>

      <Link
        href="/admin/reports/progress-score/progress"
        className="inline-flex w-max items-center gap-1 font-mono text-[12px] text-[var(--admin-primary)] hover:underline"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All {noun}
      </Link>

      <div className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-block border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--admin-primary)]">
              {typeLabel}
            </span>
            {product ? (
              <span
                className={[
                  "inline-block border bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                  publishStatusChipClass(product.status),
                ].join(" ")}
              >
                {product.status.toLowerCase()}
              </span>
            ) : null}
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {productTitle}
          </h1>
          {product ? (
            <p className="mt-2 font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
              {formatCount(product.lessonCount)} lessons · {formatCount(product.assessmentCount)}{" "}
              assessments · {formatCount(product.enrolledCount)} enrolled
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] leading-none`}
            aria-expanded={columnsOpen}
            aria-controls={columnsPanelId}
            onClick={() => {
              setColumnsOpen((open) => !open);
            }}
          >
            <Columns3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Columns
          </button>
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] leading-none disabled:opacity-50`}
            disabled={busy || loading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={openProductHref(productType)}
            className={`${ghostButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] leading-none`}
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            Open product
          </Link>
          <button
            type="button"
            className={`${primaryButtonClassName} inline-flex h-10 items-center justify-center gap-2 rounded-sm leading-none`}
            onClick={() => {
              openCohortDrawer("group");
            }}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            Cohort actions
          </button>
        </div>
      </div>

      {columnsOpen ? (
        <div
          id={columnsPanelId}
          className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Export columns
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {PROGRESS_LEARNER_COLUMN_OPTIONS.map((column) => (
              <label key={column.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={progressColumns.includes(column.key)}
                  onChange={() => {
                    setProgressColumns((current) =>
                      current.includes(column.key)
                        ? current.filter((item) => item !== column.key)
                        : [...current, column.key],
                    );
                    setPage(1);
                  }}
                />
                {column.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {summary ? (
        <SummaryBand
          summary={summary}
          onStalledClick={() => {
            setView("stalled");
            setPage(1);
          }}
        />
      ) : null}

      <CurriculumStrip curriculum={curriculum} productType={productType} />

      <div
        className="inline-flex w-max max-w-full flex-wrap border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-1"
        role="tablist"
        aria-label="Saved views"
      >
        {VIEW_TABS.map((tab) => {
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={[
                "px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
                active
                  ? "border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
              onClick={() => {
                setView(tab.key);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-sm flex-grow">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <label htmlFor={searchId} className="sr-only">
            Search learner name
          </label>
          <input
            id={searchId}
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            placeholder="Search learner name…"
            className="h-9 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-xs font-medium text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
        <Select
          value={enrolledType}
          onValueChange={(value) => {
            setEnrolledType(value);
            setPage(1);
          }}
          options={ENROLLED_TYPE_OPTIONS}
          className={selectClassName}
          ariaLabel="Enrollment type"
        />
        <Select
          value={completionBand}
          onValueChange={(value) => {
            setCompletionBand(value as ProgressCompletionBandKey | "");
            setPage(1);
          }}
          options={COMPLETION_BAND_OPTIONS}
          className={selectClassName}
          ariaLabel="Completion band"
        />
        <Select
          value={activityStatus}
          onValueChange={(value) => {
            setActivityStatus(value as ProgressLearnerActivityStatus | "");
            setPage(1);
          }}
          options={ACTIVITY_STATUS_OPTIONS}
          className={selectClassName}
          ariaLabel="Activity status"
        />
      </div>

      {selectedMembershipIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
          <p className="font-mono text-sm tabular-nums text-[var(--admin-on-surface)]">
            {formatCount(selectedMembershipIds.length)} learner
            {selectedMembershipIds.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                openCohortDrawer("group");
              }}
            >
              Create group
            </button>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                openCohortDrawer("message");
              }}
            >
              Message learners
            </button>
            <button
              type="button"
              className={`${ghostButtonClassName} inline-flex items-center gap-1`}
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {emptyFiltered ? (
        <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-8 py-16 text-center">
          <h2 className="mb-3 text-xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            No learners matched these filters
          </h2>
          <p className="mb-8 max-w-md text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Adjust search, band, or activity filters, or switch saved views to broaden the roster.
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              className={`${ghostButtonClassName} inline-flex h-11 items-center justify-center rounded-sm border-2 border-[var(--admin-on-surface)] px-8 uppercase tracking-[0.12em] leading-none text-[var(--admin-on-surface)] hover:bg-[var(--admin-on-surface)] hover:text-[var(--admin-surface)]`}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                <th className="w-10 px-4 py-3 font-medium">
                  <label className="sr-only">Select all on page</label>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    aria-checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                  />
                </th>
                <th className="min-w-[220px] px-4 py-3 font-medium">Learner</th>
                <th className="min-w-[160px] px-4 py-3 font-medium">Completion</th>
                <th className="min-w-[180px] px-4 py-3 font-medium">Last lesson</th>
                <th className="min-w-[140px] px-4 py-3 font-medium">Last activity</th>
                <th className="w-28 px-4 py-3 font-medium">Activity</th>
                <th className="w-12 px-4 py-3 text-center font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {loading && learners.length === 0
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} aria-hidden="true">
                      <td className="px-4 py-4" colSpan={7}>
                        <Shimmer className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                : learners.map((learner) => {
                    const selected = selectedIds.has(learner.membershipId);
                    const stalled = learner.activityStatus === "stalled";
                    const memberHref = `/admin/members/${learner.membershipId}`;
                    return (
                      <tr
                        key={learner.enrollmentId}
                        className={[
                          "group cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]",
                          stalled
                            ? "border-l-2 border-l-[var(--admin-warning)]"
                            : "border-l-2 border-l-transparent",
                        ].join(" ")}
                        onClick={() => {
                          navigateToLearnerDetail(learner.enrollmentId);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateToLearnerDetail(learner.enrollmentId);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open progress for ${learner.learnerName ?? learner.email ?? "learner"}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onChange={() => {
                              toggleLearnerSelection(learner.membershipId);
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface)]"
                              aria-hidden="true"
                            >
                              {learnerInitials(learner)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={memberHref}
                                className="block truncate font-semibold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                {learner.learnerName ?? "Unnamed learner"}
                              </Link>
                              <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {learner.email ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs tabular-nums text-[var(--admin-on-surface)]">
                            {formatPct(learner.completionPct)}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--admin-on-surface-variant)]">
                            {formatCount(learner.completedLessons)} of{" "}
                            {formatCount(learner.totalLessons)} lessons
                          </p>
                          <div className="mt-2 h-[3px] w-full max-w-[120px] overflow-hidden bg-[var(--admin-surface-high)]">
                            <div
                              className="h-full bg-[var(--admin-primary)]"
                              style={{
                                width: `${Math.min(100, Math.max(0, learner.completionPct))}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[200px] truncate text-[var(--admin-on-surface)]">
                            {learner.lastLessonTitle ?? "—"}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatAbsoluteDate(learner.lastActivityAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs tabular-nums text-[var(--admin-on-surface)]">
                            {formatRelativeActivity(learner.lastActivityAt)}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatAbsoluteDate(learner.lastActivityAt)}
                          </p>
                          {isExpiringWithin30Days(learner.expiresAt) ? (
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-warning)]">
                              Expires soon
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                              activityStatusChipClass(learner.activityStatus),
                            ].join(" ")}
                          >
                            {activityStatusLabel(learner.activityStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={memberHref}
                            className="inline-flex text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            aria-label={`Open member profile for ${learner.learnerName ?? learner.email ?? "learner"}`}
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {!emptyFiltered ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">
              Showing {showingFrom}–{showingTo} of {formatCount(totalCount)} learners
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              options={PAGE_SIZE_OPTIONS}
              className={selectClassName}
              ariaLabel="Rows per page"
            />
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center border border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center border border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <CohortActionsDrawer
        open={drawerOpen}
        initialMode={drawerMode}
        audience={{
          sourceKind: "progress",
          productType,
          productId,
          productTitle: product?.title ?? "Product",
          matchCount: selectedMembershipIds.length > 0 ? selectedMembershipIds.length : totalCount,
          ...(selectedMembershipIds.length > 0 ? { membershipIds: selectedMembershipIds } : {}),
          filterChips,
          suggestedGroupName: `${view !== "all" ? view.replace(/_/g, " ") : "Cohort"} — ${product?.title ?? "learners"}`,
          audienceFilters: {
            ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
            ...(enrolledType ? { enrolledType } : {}),
          },
        }}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSuccess={() => void load()}
      />
    </div>
  );
}
