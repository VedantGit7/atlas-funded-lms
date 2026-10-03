"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  Filter,
  GitCompareArrows,
  MoreVertical,
  RefreshCw,
  Search,
  Settings2,
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
  BATCH_LEARNER_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportBatchReport,
  fetchBatchDetail,
  fetchBatchLearnerDetail,
  fetchBatchLearners,
  fetchBatchesRoster,
  sendBatchMessage,
  type BatchDetail,
  type BatchHealth,
  type BatchLearnerColumnKey,
  type BatchLearnerDetail,
  type BatchLearnerItem,
  type BatchListItem,
  type BatchesListHealthFilter,
  type BatchesListSortBy,
  type BatchesListSummary,
  type BatchesListWindow,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type DrillLevel = "batches" | "learners" | "learner_detail";
type LearnerTab = "live" | "exams" | "course";
type ModuleTab = "batches" | "compare" | "exports";
type SavedView = "active" | "at_risk" | "ending_soon" | "archived";

const PAGE_SIZE = 25;

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

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
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value: string | null): string {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${String(days)} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${String(months)} months ago`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function metricBarTone(value: number | null | undefined): string {
  if (value == null) return "bg-[var(--admin-outline)]";
  if (value >= 100) return "bg-[var(--admin-success)]";
  if (value < 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-primary)]";
}

function statusPillClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (normalized === "INACTIVE") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function healthRailClass(health: BatchHealth): string {
  if (health === "critical") return "bg-[var(--admin-danger)]";
  if (health === "at_risk") return "bg-[var(--admin-warning)]";
  return "bg-transparent";
}

function windowCaption(batch: BatchListItem): string {
  const now = Date.now();
  if (batch.endsAt) {
    const ends = new Date(batch.endsAt).getTime();
    if (!Number.isNaN(ends) && ends < now) {
      const days = Math.max(1, Math.floor((now - ends) / (1000 * 60 * 60 * 24)));
      return `Ended ${String(days)} day${days === 1 ? "" : "s"} ago`;
    }
  }
  if (batch.startsAt && batch.endsAt) {
    const start = new Date(batch.startsAt).getTime();
    const end = new Date(batch.endsAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const totalWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
      const elapsedWeeks = Math.min(
        totalWeeks,
        Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24 * 7))),
      );
      if (now >= start && now <= end) {
        return `Week ${String(elapsedWeeks)} of ${String(totalWeeks)}`;
      }
    }
  }
  if (batch.startsAt) {
    const start = new Date(batch.startsAt).getTime();
    if (!Number.isNaN(start) && start > now) return "Starts soon";
  }
  return "Open window";
}

function windowProgress(batch: BatchListItem): number | null {
  if (!batch.startsAt || !batch.endsAt) return null;
  const start = new Date(batch.startsAt).getTime();
  const end = new Date(batch.endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function TripleMetricCell({
  value,
  caption,
  linked = true,
}: {
  value: number | null | undefined;
  caption: string;
  linked?: boolean;
}) {
  if (!linked || value == null) {
    return (
      <div className="min-w-[7rem]">
        <p className="font-mono text-sm font-medium text-[var(--admin-on-surface-variant)]">-</p>
        <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
          {linked ? caption : "No linked course"}
        </p>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-[7rem]">
      <p className="font-mono text-sm font-medium text-[var(--admin-on-surface)]">
        {formatPct(value)}
      </p>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${metricBarTone(value)}`}
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">{caption}</p>
    </div>
  );
}

function BatchesLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Shimmer className="mb-2 h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-20 w-32" />
          <Shimmer className="h-20 w-32" />
          <Shimmer className="h-20 w-32" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
        <div className="flex gap-2">
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-8 w-24" />
        </div>
        <Shimmer className="h-8 w-32" />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="col-span-3 h-3 w-24" />
          <Shimmer className="col-span-2 h-3 w-16" />
          <Shimmer className="col-span-2 h-3 w-16" />
          <Shimmer className="col-span-3 h-3 w-20" />
          <Shimmer className="col-span-2 h-3 w-12 justify-self-end" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="relative grid grid-cols-12 items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0"
            style={{ animationDelay: `${String(index * 40)}ms` }}
          >
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-surface-high)]" />
            <div className="col-span-3 flex items-center gap-3">
              <Shimmer className="h-6 w-6 rounded-full" />
              <Shimmer className="h-4 w-32" />
            </div>
            <div className="col-span-2">
              <Shimmer className="h-4 w-20" />
            </div>
            <div className="col-span-2">
              <Shimmer className="h-5 w-16 rounded-full" />
            </div>
            <div className="col-span-3 space-y-1">
              <div className="flex justify-between">
                <Shimmer className="h-3 w-8" />
                <Shimmer className="h-3 w-12" />
              </div>
              <Shimmer className="h-1 w-full" />
            </div>
            <div className="col-span-2 justify-self-end">
              <Shimmer className="h-4 w-10" />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="h-4 w-32" />
          <div className="flex gap-2">
            <Shimmer className="h-6 w-6" />
            <Shimmer className="h-6 w-6" />
            <Shimmer className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyBatchesState({
  hasFilters,
  onClear,
  onManage,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onManage: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-transparent to-[color-mix(in_srgb,var(--admin-primary)_4%,transparent)] px-6 py-16 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <Users
          className="h-10 w-10 text-[var(--admin-primary)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        {hasFilters ? "No batches match these filters" : "No batches yet"}
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        {hasFilters
          ? "Batches are created in Admin - Batches, or generated from a filtered report. Adjust your search criteria to see active results."
          : "Create a cohort in Manage batches to start tracking content completion, live attendance, and test scores."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <button type="button" className={secondaryButtonClassName} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
        <button type="button" className={primaryButtonClassName} onClick={onManage}>
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Manage batches
        </button>
      </div>
    </div>
  );
}

export function AdminBatchesRosterPage() {
  const router = useRouter();
  const searchId = useId();

  const [level, setLevel] = useState<DrillLevel>("batches");
  const [moduleTab, setModuleTab] = useState<ModuleTab>("batches");
  const [learnerTab, setLearnerTab] = useState<LearnerTab>("live");
  const [savedView, setSavedView] = useState<SavedView>("active");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [summary, setSummary] = useState<BatchesListSummary | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchListItem | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [learners, setLearners] = useState<BatchLearnerItem[]>([]);
  const [learnerDetail, setLearnerDetail] = useState<BatchLearnerDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQ, setSearchQ] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [windowFilter, setWindowFilter] = useState<BatchesListWindow>("any");
  const [healthFilter, setHealthFilter] = useState<BatchesListHealthFilter>("any");
  const [sortBy, setSortBy] = useState<BatchesListSortBy>("member_count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [learnerName, setLearnerName] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [learnerSortBy, setLearnerSortBy] = useState("joined_at");
  const [learnerSortDir, setLearnerSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<BatchLearnerColumnKey[]>(
    BATCH_LEARNER_COLUMN_OPTIONS.map((column) => column.key),
  );

  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchQ ||
      statusFilter !== "ACTIVE" ||
      windowFilter !== "any" ||
      healthFilter !== "any" ||
      savedView !== "active",
    );
  }, [healthFilter, savedView, searchQ, statusFilter, windowFilter]);

  const appliedChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (searchQ) {
      chips.push({
        key: "q",
        label: `Search: ${searchQ}`,
        onClear: () => {
          setSearchQ("");
          setDraftSearch("");
          setPage(1);
        },
      });
    }
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${titleCase(statusFilter)}`,
        onClear: () => {
          setStatusFilter("");
          setSavedView("active");
          setPage(1);
        },
      });
    }
    if (windowFilter !== "any") {
      chips.push({
        key: "window",
        label: `Window: ${titleCase(windowFilter)}`,
        onClear: () => {
          setWindowFilter("any");
          setPage(1);
        },
      });
    }
    if (healthFilter !== "any") {
      chips.push({
        key: "health",
        label: `Health: ${
          healthFilter === "needs_attention" ? "At risk + critical" : titleCase(healthFilter)
        }`,
        onClear: () => {
          setHealthFilter("any");
          setPage(1);
        },
      });
    }
    return chips;
  }, [healthFilter, searchQ, statusFilter, windowFilter]);

  const selectedLearnerCount = useMemo(() => {
    return batches
      .filter((batch) => selectedIds.includes(batch.id))
      .reduce((sum, batch) => sum + batch.memberCount, 0);
  }, [batches, selectedIds]);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = searchQ.trim();
      const response = await fetchBatchesRoster({
        ...(q ? { q } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        window: windowFilter,
        health: healthFilter,
        sortBy,
        sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setBatches(response.data.items);
      setSummary(response.data.summary);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setSelectedIds((current) =>
        current.filter((id) => response.data.items.some((item) => item.id === id)),
      );
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load batches.",
      );
      setBatches([]);
      setSummary(null);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [healthFilter, page, searchQ, sortBy, sortDir, statusFilter, windowFilter]);

  const loadLearners = useCallback(async () => {
    if (!selectedBatch) return;
    setLoading(true);
    setError(null);
    try {
      const trimmedName = learnerName.trim();
      const joinedFromIso = dateInputToStartIso(joinedFrom);
      const joinedToIso = dateInputToEndIso(joinedTo);
      const [detailResponse, learnersResponse] = await Promise.all([
        fetchBatchDetail(selectedBatch.id),
        fetchBatchLearners(selectedBatch.id, {
          ...(trimmedName ? { learnerName: trimmedName } : {}),
          ...(joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
          ...(joinedToIso ? { joinedTo: joinedToIso } : {}),
          sortBy: learnerSortBy,
          sortDir: learnerSortDir,
          columns,
          page,
        }),
      ]);
      setDetail(detailResponse.data);
      setLearners(learnersResponse.data.items);
      setTotalCount(learnersResponse.data.pageInfo.totalCount);
      setTotalPages(learnersResponse.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load batch learners.",
      );
      setLearners([]);
    } finally {
      setLoading(false);
    }
  }, [
    columns,
    joinedFrom,
    joinedTo,
    learnerName,
    learnerSortBy,
    learnerSortDir,
    page,
    selectedBatch,
  ]);

  useEffect(() => {
    if (level === "batches") {
      void loadBatches();
      return;
    }
    if (level === "learners") {
      void loadLearners();
    }
  }, [level, loadBatches, loadLearners]);

  useEffect(() => {
    if (level !== "learner_detail" || !selectedBatch || !learnerDetail?.membershipId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchBatchLearnerDetail(selectedBatch.id, learnerDetail.membershipId)
      .then((response) => {
        if (!cancelled) setLearnerDetail(response.data);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Unable to load learner detail.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, selectedBatch?.id, learnerDetail?.membershipId]);

  function applySavedView(view: SavedView) {
    setSavedView(view);
    setPage(1);
    setSelectedIds([]);
    if (view === "active") {
      setStatusFilter("ACTIVE");
      setHealthFilter("any");
      setWindowFilter("any");
      return;
    }
    if (view === "at_risk") {
      setStatusFilter("ACTIVE");
      setHealthFilter("needs_attention");
      setWindowFilter("any");
      return;
    }
    if (view === "ending_soon") {
      setStatusFilter("ACTIVE");
      setHealthFilter("any");
      setWindowFilter("ending_soon");
      return;
    }
    setStatusFilter("ARCHIVED");
    setHealthFilter("any");
    setWindowFilter("any");
  }

  function clearAllFilters() {
    setSearchQ("");
    setDraftSearch("");
    setStatusFilter("ACTIVE");
    setWindowFilter("any");
    setHealthFilter("any");
    setSavedView("active");
    setSortBy("member_count");
    setSortDir("desc");
    setPage(1);
    setSelectedIds([]);
  }

  function openBatch(batch: BatchListItem) {
    router.push(`/admin/reports/batches/${batch.id}`);
  }

  function openLearner(learner: BatchLearnerItem) {
    setLearnerDetail({
      batchId: selectedBatch?.id ?? "",
      batchKey: "",
      batchName: selectedBatch?.name ?? "",
      courseId: null,
      courseTitle: null,
      batchStartsAt: null,
      batchEndsAt: null,
      health: "on_track",
      membershipId: learner.membershipId,
      learnerName: learner.learnerName,
      email: learner.email,
      joinedAt: learner.joinedAt,
      activityAt: learner.activityAt,
      summary: {
        liveAttendancePct: learner.liveAttendancePct,
        liveAttendedCount: learner.liveAttendedCount,
        livePartialCount: 0,
        liveAbsentCount: 0,
        liveSessionCount: learner.liveSessionCount,
        testScorePct: learner.testScorePct,
        bestTestScorePct: null,
        testAttemptCount: learner.testAttemptCount,
        contentCompletionPct: learner.contentCompletionPct,
        completedLessons: 0,
        totalLessons: 0,
        daysInBatch: 0,
        targetDays: null,
        passMarkPct: null,
        lastActivityLabel: null,
      },
      cohortAverages: { contentCompletionPct: null, liveAttendancePct: null, testScorePct: null },
      standing: {
        completionPercentile: null,
        testPercentile: null,
        attendancePercentile: null,
        completionLabel: "",
        testLabel: "",
        attendanceLabel: "",
      },
      activityHeatmap: { cells: [], longestGapDays: null },
      membership: {
        membershipId: learner.membershipId,
        joinedAt: learner.joinedAt,
        role: "",
        source: "",
        addedBy: "",
      },
      liveAttendance: [],
      exams: [],
      courseProgress: [],
      lessonStrip: [],
    });
    setLearnerTab("live");
    setLevel("learner_detail");
  }

  function goBack() {
    if (level === "learner_detail") {
      setLearnerDetail(null);
      setLevel("learners");
      return;
    }
    setSelectedBatch(null);
    setDetail(null);
    setLearners([]);
    setPage(1);
    setLevel("batches");
  }

  async function handleExport(batchId?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await exportBatchReport({
        batchId: batchId ?? selectedBatch?.id,
        learnerName: learnerName.trim() || undefined,
        joinedFrom: dateInputToStartIso(joinedFrom),
        joinedTo: dateInputToEndIso(joinedTo),
        columns,
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

  async function handleSendMessage() {
    if (!selectedBatch || !messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendBatchMessage({
        batchId: selectedBatch.id,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        learnerName: learnerName.trim() || undefined,
        joinedFrom: dateInputToStartIso(joinedFrom),
        joinedTo: dateInputToEndIso(joinedTo),
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

  function toggleSelectAll() {
    if (selectedIds.length === batches.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(batches.map((batch) => batch.id));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      {level === "batches" ? (
        <>
          <nav
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
              Reports
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-[var(--admin-on-surface)]">Batches</span>
          </nav>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                Batches
              </h1>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Cohort-level completion, live attendance, and test performance across every batch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={selectedIds.length < 2}
                title={
                  selectedIds.length < 2
                    ? "Select at least two batches to compare"
                    : "Compare selected batches"
                }
                onClick={() => {
                  const ids = selectedIds.slice(0, 4).join(",");
                  router.push(`/admin/reports/batches/compare?ids=${ids}`);
                }}
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                Compare batches
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={busy}
                onClick={() => void handleExport()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </button>
              <Link href="/admin/batches" className={primaryButtonClassName}>
                Manage batches
              </Link>
            </div>
          </div>

          <div className="border-b border-[var(--admin-border)]">
            <div className="flex gap-1" role="tablist" aria-label="Batches module">
              {(
                [
                  ["batches", "Batches"],
                  ["compare", "Compare"],
                  ["exports", "Exports"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={moduleTab === value}
                  className={[
                    "h-10 px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                    moduleTab === value
                      ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
                  ].join(" ")}
                  onClick={() => {
                    if (value === "compare") {
                      if (selectedIds.length >= 2) {
                        router.push(
                          `/admin/reports/batches/compare?ids=${selectedIds.slice(0, 4).join(",")}`,
                        );
                        return;
                      }
                      router.push("/admin/reports/batches/compare");
                      return;
                    }
                    if (value === "exports") {
                      router.push("/admin/reports/batches/exports");
                      return;
                    }
                    setModuleTab("batches");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {moduleTab === "compare" ? (
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <GitCompareArrows
                className="mx-auto mb-4 h-10 w-10 text-[var(--admin-outline)]"
                aria-hidden="true"
                strokeWidth={1.5}
              />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Compare selected cohorts
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Select two to four batches, then open the comparison matrix to line up completion,
                attendance, and test scores side by side.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={selectedIds.length < 2}
                  onClick={() => {
                    const ids = selectedIds.slice(0, 4).join(",");
                    router.push(`/admin/reports/batches/compare?ids=${ids}`);
                  }}
                >
                  Open comparison
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => {
                    router.push("/admin/reports/batches/compare");
                  }}
                >
                  Open empty compare
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setModuleTab("batches");
                  }}
                >
                  Back to batches
                </button>
              </div>
            </div>
          ) : null}

          {moduleTab === "exports" ? (
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <Download
                className="mx-auto mb-4 h-10 w-10 text-[var(--admin-outline)]"
                aria-hidden="true"
                strokeWidth={1.5}
              />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Batch exports
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Open the exports workspace for history, schedules, and new export configuration.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    router.push("/admin/reports/batches/exports");
                  }}
                >
                  Open exports
                </button>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy}
                  onClick={() => void handleExport()}
                >
                  {busy ? "Queuing…" : "Quick CSV export"}
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setModuleTab("batches");
                  }}
                >
                  Back to batches
                </button>
              </div>
            </div>
          ) : null}

          {moduleTab === "batches" ? (
            <>
              {error ? (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--admin-danger)]">
                        Couldn&apos;t load batches.
                      </p>
                      <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                        {error}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px"
                    onClick={() => void loadBatches()}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </button>
                </div>
              ) : null}

              {loading && batches.length === 0 && !error ? (
                <BatchesLoadingSkeleton />
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-6">
                    <button
                      type="button"
                      className="col-span-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                      onClick={() => {
                        applySavedView("active");
                      }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Active batches
                      </p>
                      <p className="mt-2 font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
                        {(summary?.activeBatchCount ?? 0).toLocaleString()}
                      </p>
                      <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                        {(summary?.totalLearners ?? 0).toLocaleString()} learners enrolled
                      </p>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div className="h-full w-2/3 rounded-full bg-[var(--admin-primary)]" />
                      </div>
                    </button>
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Avg completion
                      </p>
                      <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
                        {formatPct(summary?.avgContentCompletionPct)}
                      </p>
                      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className={`h-full rounded-full ${metricBarTone(summary?.avgContentCompletionPct)}`}
                          style={{
                            width: `${String(Math.max(0, Math.min(100, summary?.avgContentCompletionPct ?? 0)))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Avg attendance
                      </p>
                      <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
                        {formatPct(summary?.avgLiveAttendancePct)}
                      </p>
                      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className={`h-full rounded-full ${metricBarTone(summary?.avgLiveAttendancePct)}`}
                          style={{
                            width: `${String(Math.max(0, Math.min(100, summary?.avgLiveAttendancePct ?? 0)))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]"
                      onClick={() => {
                        applySavedView("at_risk");
                      }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-warning)]">
                        Batches at risk
                      </p>
                      <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-warning)]">
                        {(summary?.atRiskCount ?? 0).toLocaleString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                      onClick={() => {
                        applySavedView("ending_soon");
                      }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Ending in 30 days
                      </p>
                      <p className="mt-2 font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
                        {(summary?.endingSoonCount ?? 0).toLocaleString()}
                      </p>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["active", "Active batches"],
                        ["at_risk", "At risk"],
                        ["ending_soon", "Ending soon"],
                        ["archived", "Archived"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={[
                          "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                          savedView === value
                            ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                            : "bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                        ].join(" ")}
                        onClick={() => {
                          applySavedView(value);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <label
                        className="relative flex min-w-0 flex-1 items-center"
                        htmlFor={searchId}
                      >
                        <Search
                          className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                          aria-hidden="true"
                        />
                        <input
                          id={searchId}
                          className={`${fieldClassName} w-full pl-9`}
                          placeholder="Search batch name or key"
                          value={draftSearch}
                          onChange={(event) => {
                            setDraftSearch(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setSearchQ(draftSearch.trim());
                              setPage(1);
                            }
                          }}
                        />
                      </label>
                      <div className="hidden h-6 w-px bg-[var(--admin-border)] lg:block" />
                      <Select
                        className={selectClassName}
                        value={statusFilter}
                        onValueChange={(value) => {
                          setStatusFilter(value);
                          setPage(1);
                        }}
                        options={[
                          { value: "", label: "Status: All" },
                          { value: "ACTIVE", label: "Active" },
                          { value: "INACTIVE", label: "Inactive" },
                          { value: "ARCHIVED", label: "Archived" },
                        ]}
                        ariaLabel="Status"
                      />
                      <Select
                        className={selectClassName}
                        value={windowFilter}
                        onValueChange={(value) => {
                          setWindowFilter(value as BatchesListWindow);
                          setPage(1);
                        }}
                        options={[
                          { value: "any", label: "Window: Any" },
                          { value: "running", label: "Running now" },
                          { value: "starting_soon", label: "Starting soon" },
                          { value: "ending_soon", label: "Ending soon" },
                          { value: "ended", label: "Ended" },
                        ]}
                        ariaLabel="Window"
                      />
                      <Select
                        className={selectClassName}
                        value={healthFilter}
                        onValueChange={(value) => {
                          setHealthFilter(value as BatchesListHealthFilter);
                          setPage(1);
                        }}
                        options={[
                          { value: "any", label: "Health: All" },
                          { value: "on_track", label: "On track" },
                          { value: "needs_attention", label: "At risk + critical" },
                          { value: "at_risk", label: "At risk" },
                          { value: "critical", label: "Critical" },
                        ]}
                        ariaLabel="Health"
                      />
                      <Select
                        className={selectClassName}
                        value={`${sortBy}:${sortDir}`}
                        onValueChange={(value) => {
                          const [nextSort, nextDir] = value.split(":");
                          setSortBy(nextSort as BatchesListSortBy);
                          setSortDir(nextDir === "asc" ? "asc" : "desc");
                          setPage(1);
                        }}
                        options={[
                          { value: "member_count:desc", label: "Learners desc" },
                          { value: "avg_content_completion_pct:asc", label: "Completion asc" },
                          { value: "avg_live_attendance_pct:asc", label: "Attendance asc" },
                          { value: "starts_at:desc", label: "Start date desc" },
                          { value: "name:asc", label: "Name A-Z" },
                          { value: "created_at:desc", label: "Created desc" },
                        ]}
                        ariaLabel="Sort"
                      />
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-3 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
                        onClick={() => {
                          setSearchQ(draftSearch.trim());
                          setPage(1);
                        }}
                      >
                        <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                        Apply
                        {appliedChips.length > 0 ? ` (${String(appliedChips.length)})` : ""}
                      </button>
                    </div>
                    {appliedChips.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
                        {appliedChips.map((chip) => (
                          <button
                            key={chip.key}
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px] text-[var(--admin-on-surface)]"
                            onClick={chip.onClear}
                          >
                            {chip.label}
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ))}
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                          onClick={clearAllFilters}
                        >
                          Clear all
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {selectedIds.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                      <p className="text-sm text-[var(--admin-on-surface)]">
                        <span className="font-mono font-medium">{selectedIds.length}</span> batches
                        selected ·{" "}
                        <span className="font-mono font-medium">
                          {selectedLearnerCount.toLocaleString()}
                        </span>{" "}
                        learners
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={selectedIds.length < 2}
                          onClick={() => {
                            const ids = selectedIds.slice(0, 4).join(",");
                            router.push(`/admin/reports/batches/compare?ids=${ids}`);
                          }}
                        >
                          Compare
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={busy || selectedIds.length !== 1}
                          onClick={() => void handleExport(selectedIds[0])}
                        >
                          Export selection
                        </button>
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          onClick={() => {
                            setSelectedIds([]);
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead>
                          <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            <th className="w-11 px-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--admin-primary)]"
                                checked={
                                  batches.length > 0 && selectedIds.length === batches.length
                                }
                                onChange={toggleSelectAll}
                                aria-label="Select all batches on this page"
                              />
                            </th>
                            <th className="px-3">Batch</th>
                            <th className="px-3">Course</th>
                            <th className="px-3">Status</th>
                            <th className="px-3 text-right">Learners</th>
                            <th className="px-3">Content completion</th>
                            <th className="px-3">Live attendance</th>
                            <th className="px-3">Test score</th>
                            <th className="px-3">Window</th>
                            <th className="px-3">Last activity</th>
                            <th className="w-12 px-3">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {!loading && batches.length === 0 ? (
                            <tr>
                              <td colSpan={11} className="p-0">
                                {error ? (
                                  <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                                    <CloudOff
                                      className="mb-4 h-12 w-12 text-[var(--admin-outline)]"
                                      aria-hidden="true"
                                      strokeWidth={1.25}
                                    />
                                    <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                                      Data unavailable
                                    </h3>
                                    <p className="mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                                      We are unable to display the live batches report at this time.
                                      Please try refreshing or check your connection.
                                    </p>
                                  </div>
                                ) : (
                                  <EmptyBatchesState
                                    hasFilters={hasActiveFilters}
                                    onClear={clearAllFilters}
                                    onManage={() => {
                                      router.push("/admin/batches");
                                    }}
                                  />
                                )}
                              </td>
                            </tr>
                          ) : (
                            batches.map((batch, index) => {
                              const progress = windowProgress(batch);
                              const selected = selectedIds.includes(batch.id);
                              return (
                                <tr
                                  key={batch.id}
                                  className={[
                                    "group relative h-11 border-b border-[var(--admin-border)] last:border-b-0",
                                    "cursor-pointer transition-colors duration-150",
                                    selected
                                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                                      : "hover:bg-[var(--admin-surface-high)]",
                                    batch.status === "ARCHIVED" ? "opacity-70" : "",
                                  ].join(" ")}
                                  style={{
                                    animationDelay: `${String(Math.min(index, 11) * 20)}ms`,
                                  }}
                                  onClick={() => {
                                    openBatch(batch);
                                  }}
                                >
                                  <td
                                    className="relative px-3"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    <span
                                      className={`absolute bottom-0 left-0 top-0 w-1 ${healthRailClass(batch.health)}`}
                                      aria-hidden="true"
                                    />
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-[var(--admin-primary)]"
                                      checked={selected}
                                      onChange={() => {
                                        toggleSelect(batch.id);
                                      }}
                                      aria-label={`Select ${batch.name}`}
                                    />
                                  </td>
                                  <td className="px-3">
                                    <div className="font-medium text-[var(--admin-primary)]">
                                      {batch.name}
                                    </div>
                                    <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {batch.key}
                                    </div>
                                  </td>
                                  <td className="px-3 text-[var(--admin-on-surface)]">
                                    {batch.courseTitle ?? (
                                      <span className="text-[var(--admin-on-surface-variant)]">
                                        No linked course
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3">
                                    <span
                                      className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusPillClass(batch.status)}`}
                                    >
                                      {titleCase(batch.status)}
                                    </span>
                                  </td>
                                  <td className="px-3 text-right font-mono text-[var(--admin-on-surface)]">
                                    {batch.memberCount.toLocaleString()}
                                  </td>
                                  <td className="px-3">
                                    <TripleMetricCell
                                      value={batch.avgContentCompletionPct}
                                      caption="Avg lessons finished"
                                      linked={Boolean(batch.courseId)}
                                    />
                                  </td>
                                  <td className="px-3">
                                    <TripleMetricCell
                                      value={batch.avgLiveAttendancePct}
                                      caption="Avg sessions joined"
                                    />
                                  </td>
                                  <td className="px-3">
                                    <TripleMetricCell
                                      value={batch.avgTestScorePct}
                                      caption="Avg assessment score"
                                      linked={Boolean(batch.courseId)}
                                    />
                                  </td>
                                  <td className="px-3">
                                    <p className="font-mono text-[12px] text-[var(--admin-on-surface)]">
                                      {batch.startsAt || batch.endsAt
                                        ? `${formatDate(batch.startsAt)} → ${formatDate(batch.endsAt)}`
                                        : "-"}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {windowCaption(batch)}
                                    </p>
                                    {progress != null ? (
                                      <div className="mt-1 h-[3px] w-28 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                        <div
                                          className="h-full rounded-full bg-[var(--admin-primary)]"
                                          style={{ width: `${String(progress)}%` }}
                                        />
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-3">
                                    <p className="text-sm text-[var(--admin-on-surface)]">
                                      {formatRelative(batch.lastActivityAt)}
                                    </p>
                                    <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {formatDateTime(batch.lastActivityAt)}
                                    </p>
                                  </td>
                                  <td
                                    className="relative px-3"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                                      aria-label={`Actions for ${batch.name}`}
                                      onClick={() => {
                                        setRowMenuId((current) =>
                                          current === batch.id ? null : batch.id,
                                        );
                                      }}
                                    >
                                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    {rowMenuId === batch.id ? (
                                      <div className="absolute right-3 top-10 z-20 w-48 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                        <button
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                          onClick={() => {
                                            openBatch(batch);
                                          }}
                                        >
                                          Open report
                                        </button>
                                        <button
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                          onClick={() => void handleExport(batch.id)}
                                        >
                                          Export batch
                                        </button>
                                        <Link
                                          href="/admin/batches"
                                          className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                        >
                                          Open batch settings
                                        </Link>
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {totalCount > 0 ? (
                      <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                            Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()} batches
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                            At risk: any metric below 40% or no activity in 14 days. Critical: two
                            or more metrics below 40%.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={ghostButtonClassName}
                            disabled={page <= 1 || loading}
                            onClick={() => {
                              setPage((current) => Math.max(1, current - 1));
                            }}
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                            {page} / {Math.max(totalPages, 1)}
                          </span>
                          <button
                            type="button"
                            className={ghostButtonClassName}
                            disabled={page >= totalPages || loading || totalPages === 0}
                            onClick={() => {
                              setPage((current) => current + 1);
                            }}
                            aria-label="Next page"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {level !== "batches" ? (
        <>
          <nav
            className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <button
              type="button"
              className="hover:text-[var(--admin-primary)]"
              onClick={() => {
                setSelectedBatch(null);
                setDetail(null);
                setLearners([]);
                setLearnerDetail(null);
                setPage(1);
                setLevel("batches");
              }}
            >
              Batches
            </button>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            {level === "learners" ? (
              <span className="font-medium text-[var(--admin-on-surface)]">
                {detail?.name ?? selectedBatch?.name ?? "Batch"}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="hover:text-[var(--admin-primary)]"
                  onClick={() => {
                    setLearnerDetail(null);
                    setLevel("learners");
                  }}
                >
                  {selectedBatch?.name ?? "Batch"}
                </button>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-medium text-[var(--admin-on-surface)]">
                  {learnerDetail?.learnerName ?? learnerDetail?.email ?? "Learner"}
                </span>
              </>
            )}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={ghostButtonClassName} onClick={goBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to {level === "learner_detail" ? "learners" : "batches"}
            </button>
          </div>

          {error ? (
            <div
              className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                  aria-hidden="true"
                />
                <p className="text-sm text-[var(--admin-danger)]">{error}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)]"
                onClick={() => {
                  if (level === "learners") void loadLearners();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {level === "learners" && selectedBatch ? (
        <>
          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  {detail?.name ?? selectedBatch.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  {detail?.courseTitle
                    ? `Linked course: ${detail.courseTitle}`
                    : "No linked course - metrics use available learner activity."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={busy || loading}
                  onClick={() => void handleExport(selectedBatch.id)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export CSV
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setActionsOpen((open) => !open);
                  }}
                >
                  {actionsOpen ? "Hide message" : "Send message"}
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Learners",
                  value: String(detail?.memberCount ?? selectedBatch.memberCount),
                },
                {
                  label: "Avg content completion",
                  value: formatPct(detail?.averages.contentCompletionPct),
                },
                {
                  label: "Avg live attendance",
                  value: formatPct(detail?.averages.liveAttendancePct),
                },
                {
                  label: "Active (14d)",
                  value: String(detail?.averages.activeLearnerCount ?? "-"),
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    {card.label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Learner name
                <input
                  className={fieldClassName}
                  value={learnerName}
                  onChange={(event) => {
                    setLearnerName(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Joined from
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedFrom}
                  onChange={(event) => {
                    setJoinedFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Joined to
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedTo}
                  onChange={(event) => {
                    setJoinedTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Sort
                <select
                  className={fieldClassName}
                  value={`${learnerSortBy}:${learnerSortDir}`}
                  onChange={(event) => {
                    const [nextSort, nextDir] = event.target.value.split(":");
                    setLearnerSortBy(nextSort ?? "joined_at");
                    setLearnerSortDir(nextDir === "asc" ? "asc" : "desc");
                  }}
                >
                  <option value="joined_at:desc">Joined · newest</option>
                  <option value="joined_at:asc">Joined · oldest</option>
                  <option value="activity_at:desc">Activity · recent</option>
                  <option value="content_completion_pct:desc">Completion · high</option>
                  <option value="live_attendance_pct:desc">Attendance · high</option>
                  <option value="test_score_pct:desc">Test · high</option>
                  <option value="learner_name:asc">Name · A-Z</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              {BATCH_LEARNER_COLUMN_OPTIONS.map((column) => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 text-xs text-[var(--admin-on-surface)]"
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--admin-primary)]"
                    checked={columns.includes(column.key)}
                    onChange={(event) => {
                      setColumns((current) => {
                        if (event.target.checked) return [...current, column.key];
                        return current.filter((key) => key !== column.key);
                      });
                    }}
                  />
                  {column.label}
                </label>
              ))}
            </div>

            {actionsOpen ? (
              <div className="mt-4 grid gap-3 border-t border-[var(--admin-border)] pt-4">
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Subject
                  <input
                    className={fieldClassName}
                    value={messageSubject}
                    onChange={(event) => {
                      setMessageSubject(event.target.value);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Message
                  <textarea
                    className={`${fieldClassName} h-auto py-2`}
                    rows={4}
                    value={messageBody}
                    onChange={(event) => {
                      setMessageBody(event.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                  onClick={() => void handleSendMessage()}
                >
                  Send message
                </button>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Shimmer key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      {columns.includes("learner_name") ? (
                        <th className="px-4 py-3">Learner</th>
                      ) : null}
                      {columns.includes("activity_at") ? (
                        <th className="px-4 py-3">Activity</th>
                      ) : null}
                      {columns.includes("live_attendance_pct") ? (
                        <th className="px-4 py-3">Live attendance</th>
                      ) : null}
                      {columns.includes("test_score_pct") ? (
                        <th className="px-4 py-3">Test</th>
                      ) : null}
                      {columns.includes("content_completion_pct") ? (
                        <th className="px-4 py-3">Content</th>
                      ) : null}
                      {columns.includes("joined_at") ? <th className="px-4 py-3">Joined</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {learners.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-10 text-center text-[var(--admin-on-surface-variant)]"
                          colSpan={6}
                        >
                          No learners in this batch matched the filters.
                        </td>
                      </tr>
                    ) : (
                      learners.map((learner) => (
                        <tr
                          key={learner.membershipId}
                          className="h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            openLearner(learner);
                          }}
                        >
                          {columns.includes("learner_name") ? (
                            <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                              {learner.learnerName ?? learner.email ?? "Learner"}
                              {columns.includes("email") && learner.email ? (
                                <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {learner.email}
                                </div>
                              ) : null}
                            </td>
                          ) : null}
                          {columns.includes("activity_at") ? (
                            <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(learner.activityAt)}
                            </td>
                          ) : null}
                          {columns.includes("live_attendance_pct") ? (
                            <td className="px-4 py-3">
                              <TripleMetricCell
                                value={learner.liveAttendancePct}
                                caption={`${String(learner.liveAttendedCount)} of ${String(learner.liveSessionCount)} sessions`}
                              />
                            </td>
                          ) : null}
                          {columns.includes("test_score_pct") ? (
                            <td className="px-4 py-3">
                              <TripleMetricCell
                                value={learner.testScorePct}
                                caption={`${String(learner.testAttemptCount)} attempts`}
                              />
                            </td>
                          ) : null}
                          {columns.includes("content_completion_pct") ? (
                            <td className="px-4 py-3">
                              <TripleMetricCell
                                value={learner.contentCompletionPct}
                                caption={`${String(learner.completedLessons)} of ${String(learner.totalLessons)} lessons`}
                              />
                            </td>
                          ) : null}
                          {columns.includes("joined_at") ? (
                            <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(learner.joinedAt)}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Page {page} of {totalPages} · {totalCount} learners
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {level === "learner_detail" && learnerDetail ? (
        <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                {learnerDetail.learnerName ?? learnerDetail.email ?? "Learner"}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Joined {formatDateTime(learnerDetail.joinedAt)} · Last activity{" "}
                {formatDateTime(learnerDetail.activityAt)}
              </p>
            </div>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                router.push(`/admin/members/${learnerDetail.membershipId}`);
              }}
            >
              Open profile
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Live attendance
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.liveAttendancePct)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Test score
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.testScorePct)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Content completion
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatPct(learnerDetail.summary.contentCompletionPct)}
              </p>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["live", "Live class attendance"],
                ["exams", "Exam"],
                ["course", "Course completion"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={learnerTab === key ? primaryButtonClassName : ghostButtonClassName}
                onClick={() => {
                  setLearnerTab(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Shimmer key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : learnerTab === "live" ? (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerDetail.liveAttendance.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[var(--admin-on-surface-variant)]" colSpan={5}>
                        No live sessions linked to this batch/course yet.
                      </td>
                    </tr>
                  ) : (
                    learnerDetail.liveAttendance.map((row) => (
                      <tr
                        key={row.liveSessionId}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">{row.title}</td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(row.scheduledAt)}
                        </td>
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {titleCase(row.status)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(row.joinedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface)]">
                          {row.durationSeconds == null ? "-" : `${String(row.durationSeconds)}s`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : learnerTab === "exams" ? (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-3">Assessment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerDetail.exams.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[var(--admin-on-surface-variant)]" colSpan={4}>
                        No exam attempts found for this learner in the batch scope.
                      </td>
                    </tr>
                  ) : (
                    learnerDetail.exams.map((row) => (
                      <tr
                        key={row.attemptId}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {row.assessmentTitle}
                        </td>
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {titleCase(row.attemptStatus)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                          {formatPct(row.scorePct)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(row.submittedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerDetail.courseProgress.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-[var(--admin-on-surface-variant)]" colSpan={4}>
                        No course progress found for this learner.
                      </td>
                    </tr>
                  ) : (
                    learnerDetail.courseProgress.map((row) => (
                      <tr
                        key={row.courseId}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                          {row.courseTitle}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                          {row.completedLessons}
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                          {row.totalLessons}
                        </td>
                        <td className="px-4 py-3">
                          <TripleMetricCell
                            value={row.completionPct}
                            caption={`${String(row.completedLessons)} of ${String(row.totalLessons)} lessons`}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
