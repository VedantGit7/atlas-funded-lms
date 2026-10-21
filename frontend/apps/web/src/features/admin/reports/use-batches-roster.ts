"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  BATCHES_ROSTER_DEFAULTS,
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
import { useReportLoad } from "./use-report-load";
import { useViewerLocale } from "./viewer-time";
import {
  type BatchesRosterProps,
  type DrillLevel,
  type LearnerTab,
  type ModuleTab,
  PAGE_SIZE,
  type SavedView,
  titleCase,
} from "./admin-batches-roster-shared";

/** The state, data loading and handlers behind BatchesRoster. */
export function useBatchesRoster(props: BatchesRosterProps) {
  const { initialRoster } = props;
  const router = useRouter();
  const searchId = useId();
  const viewer = useViewerLocale();
  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => initialRoster ?? null);

  const [level, setLevel] = useState<DrillLevel>("batches");
  const [moduleTab, setModuleTab] = useState<ModuleTab>("batches");
  const [learnerTab, setLearnerTab] = useState<LearnerTab>("live");
  const [savedView, setSavedView] = useState<SavedView>("active");

  const [loading, setLoading] = useState(initial === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<BatchListItem[]>(initial?.data.items ?? []);
  const [summary, setSummary] = useState<BatchesListSummary | null>(initial?.data.summary ?? null);
  const [selectedBatch, setSelectedBatch] = useState<BatchListItem | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [learners, setLearners] = useState<BatchLearnerItem[]>([]);
  const [learnerDetail, setLearnerDetail] = useState<BatchLearnerDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [page, setPage] = useState<number>(BATCHES_ROSTER_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initial?.data.pageInfo.totalCount ?? 0);

  const [searchQ, setSearchQ] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(BATCHES_ROSTER_DEFAULTS.status);
  const [windowFilter, setWindowFilter] = useState<BatchesListWindow>(
    BATCHES_ROSTER_DEFAULTS.window,
  );
  const [healthFilter, setHealthFilter] = useState<BatchesListHealthFilter>(
    BATCHES_ROSTER_DEFAULTS.health,
  );
  const [sortBy, setSortBy] = useState<BatchesListSortBy>(BATCHES_ROSTER_DEFAULTS.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(BATCHES_ROSTER_DEFAULTS.sortDir);

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

  const loadBatches = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
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
        if (!soft) setLoading(false);
      }
    },
    [healthFilter, page, searchQ, sortBy, sortDir, statusFilter, windowFilter],
  );

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

  const loadLevel = useCallback(
    async (options?: { soft?: boolean }) => {
      if (level === "batches") {
        await loadBatches(options);
        return;
      }
      if (level === "learners") {
        await loadLearners();
      }
    },
    [level, loadBatches, loadLearners],
  );

  useReportLoad(loadLevel, initial);

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
  const totalCountLabel = totalCount.toLocaleString(viewer.locale);

  return {
    router,
    searchId,
    viewer,
    level,
    setLevel,
    moduleTab,
    setModuleTab,
    learnerTab,
    setLearnerTab,
    savedView,
    loading,
    busy,
    error,
    batches,
    summary,
    selectedBatch,
    setSelectedBatch,
    detail,
    setDetail,
    learners,
    setLearners,
    learnerDetail,
    setLearnerDetail,
    selectedIds,
    setSelectedIds,
    page,
    setPage,
    totalPages,
    totalCount,
    setSearchQ,
    draftSearch,
    setDraftSearch,
    statusFilter,
    setStatusFilter,
    windowFilter,
    setWindowFilter,
    healthFilter,
    setHealthFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    learnerName,
    setLearnerName,
    joinedFrom,
    setJoinedFrom,
    joinedTo,
    setJoinedTo,
    learnerSortBy,
    setLearnerSortBy,
    learnerSortDir,
    setLearnerSortDir,
    columns,
    setColumns,
    messageSubject,
    setMessageSubject,
    messageBody,
    setMessageBody,
    actionsOpen,
    setActionsOpen,
    rowMenuId,
    setRowMenuId,
    hasActiveFilters,
    appliedChips,
    selectedLearnerCount,
    loadBatches,
    loadLearners,
    applySavedView,
    clearAllFilters,
    openBatch,
    openLearner,
    goBack,
    handleExport,
    handleSendMessage,
    toggleSelectAll,
    toggleSelect,
    rangeStart,
    rangeEnd,
    totalCountLabel,
  };
}

export type BatchesRosterView = ReturnType<typeof useBatchesRoster>;
