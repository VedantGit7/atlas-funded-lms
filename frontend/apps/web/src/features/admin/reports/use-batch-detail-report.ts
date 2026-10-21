"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  BATCH_LEARNERS_DEFAULTS,
  parseBatchDetailTab,
  dateInputToEndIso,
  dateInputToStartIso,
  exportBatchReport,
  fetchBatchDetail,
  fetchBatchLearnerDetail,
  fetchBatchLearners,
  sendBatchMessage,
  type BatchDetail,
  type BatchLearnerColumnKey,
  type BatchLearnerDetail,
  type BatchLearnerItem,
  type BatchesListHealthFilter,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer } from "./viewer-time";
import {
  type BatchDetailPageProps,
  type CompletionOp,
  DEFAULT_COLUMNS,
  type DetailTab,
  type LearnerPanelTab,
  PAGE_SIZE,
  formatCountFor,
  formatDateFor,
  formatDateTimeFor,
  formatRelativeFor,
  isStaleActivityFor,
  weekCaptionFor,
} from "./admin-batch-detail-shared";

/** The state, data loading and handlers behind BatchDetailReport. */
export function useBatchDetailReport(props: BatchDetailPageProps) {
  const { batchId, initialDetail, initialLearners } = props;
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatDate = withViewer(formatDateFor, viewer);
  const formatDateTime = withViewer(formatDateTimeFor, viewer);
  const formatRelative = withViewer(formatRelativeFor, viewer);
  const isStaleActivity = withViewer(isStaleActivityFor, viewer);
  const weekCaption = withViewer(weekCaptionFor, viewer);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();
  const columnsPanelId = useId();
  const columnsRef = useRef<HTMLDivElement | null>(null);

  const activeTab = parseBatchDetailTab(searchParams.get("tab"));

  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => ({
    detail: initialDetail ?? null,
    learners: initialLearners ?? null,
  }));
  const [detail, setDetail] = useState<BatchDetail | null>(initial.detail?.data ?? null);
  const [detailLoading, setDetailLoading] = useState(initial.detail === null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [learners, setLearners] = useState<BatchLearnerItem[]>(initial.learners?.data.items ?? []);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(BATCH_LEARNERS_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial.learners?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initial.learners?.data.pageInfo.totalCount ?? 0);

  const [draftSearch, setDraftSearch] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [completionOp, setCompletionOp] = useState<CompletionOp>("gte");
  const [completionValue, setCompletionValue] = useState("");
  const [healthFilter, setHealthFilter] = useState<BatchesListHealthFilter>("any");
  const [sortBy, setSortBy] = useState<string>(BATCH_LEARNERS_DEFAULTS.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(BATCH_LEARNERS_DEFAULTS.sortDir);

  const [columns, setColumns] = useState<BatchLearnerColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<BatchLearnerColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageMembershipIds, setMessageMembershipIds] = useState<string[] | null>(null);

  const [learnerDetail, setLearnerDetail] = useState<BatchLearnerDetail | null>(null);
  const [learnerPanelTab, setLearnerPanelTab] = useState<LearnerPanelTab>("live");
  const [learnerDetailLoading, setLearnerDetailLoading] = useState(false);
  const [learnerDetailError, setLearnerDetailError] = useState<string | null>(null);

  const passMark = detail?.averages.passMarkPct ?? 70;

  const setTab = useCallback(
    (tab: DetailTab) => {
      if (tab === "live_sessions") {
        router.push(`/admin/reports/batches/${batchId}/live-sessions`);
        return;
      }
      if (tab === "exams") {
        router.push(`/admin/reports/batches/${batchId}/exams`);
        return;
      }
      if (tab === "content") {
        router.push(`/admin/reports/batches/${batchId}/content`);
        return;
      }
      if (tab === "messages") {
        router.push(`/admin/reports/batches/${batchId}/messages`);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.replace(
        query ? `/admin/reports/batches/${batchId}?${query}` : `/admin/reports/batches/${batchId}`,
      );
    },
    [batchId, router, searchParams],
  );

  const loadDetail = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await fetchBatchDetail(batchId);
        setDetail(response.data);
      } catch (loadError) {
        setDetail(null);
        setDetailError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Couldn't load this batch report.",
        );
      } finally {
        if (!soft) setDetailLoading(false);
      }
    },
    [batchId],
  );

  const loadLearners = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLearnersLoading(true);
      setLearnersError(null);
      try {
        const trimmedName = learnerName.trim();
        const joinedFromIso = dateInputToStartIso(joinedFrom);
        const joinedToIso = dateInputToEndIso(joinedTo);
        const parsedCompletion = completionValue.trim()
          ? Number(completionValue.trim())
          : undefined;
        const completionFilter =
          parsedCompletion != null && !Number.isNaN(parsedCompletion)
            ? completionOp === "gte"
              ? { minCompletion: parsedCompletion }
              : { maxCompletion: parsedCompletion }
            : {};

        const response = await fetchBatchLearners(batchId, {
          ...(trimmedName ? { learnerName: trimmedName } : {}),
          ...(joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
          ...(joinedToIso ? { joinedTo: joinedToIso } : {}),
          ...completionFilter,
          ...(healthFilter !== "any" ? { health: healthFilter } : {}),
          sortBy,
          sortDir,
          columns,
          page,
          limit: BATCH_LEARNERS_DEFAULTS.limit,
        });
        setLearners(response.data.items);
        setTotalCount(response.data.pageInfo.totalCount);
        setTotalPages(response.data.pageInfo.totalPages);
        setSelectedIds((current) =>
          current.filter((id) => response.data.items.some((item) => item.membershipId === id)),
        );
      } catch (loadError) {
        setLearners([]);
        setTotalCount(0);
        setTotalPages(0);
        setLearnersError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Unable to load batch learners.",
        );
      } finally {
        if (!soft) setLearnersLoading(false);
      }
    },
    [
      batchId,
      columns,
      completionOp,
      completionValue,
      healthFilter,
      joinedFrom,
      joinedTo,
      learnerName,
      page,
      sortBy,
      sortDir,
    ],
  );

  useReportLoad(loadDetail, initial.detail);

  useEffect(() => {
    if (activeTab === "live_sessions") {
      router.replace(`/admin/reports/batches/${batchId}/live-sessions`);
    }
    if (activeTab === "exams") {
      router.replace(`/admin/reports/batches/${batchId}/exams`);
    }
    if (activeTab === "content") {
      router.replace(`/admin/reports/batches/${batchId}/content`);
    }
    if (activeTab === "messages") {
      router.replace(`/admin/reports/batches/${batchId}/messages`);
    }
  }, [activeTab, batchId, router]);

  // Learners load only on their tab.
  const loadLearnersOnTab = useCallback(
    async (options?: { soft?: boolean }) => {
      if (activeTab !== "learners") return;
      await loadLearners(options);
    },
    [activeTab, loadLearners],
  );

  useReportLoad(loadLearnersOnTab, initial.learners);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!columnsRef.current) return;
      if (!columnsRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [columnsOpen]);

  useEffect(() => {
    if (!learnerDetail?.membershipId) return;
    let cancelled = false;
    setLearnerDetailLoading(true);
    setLearnerDetailError(null);
    void fetchBatchLearnerDetail(batchId, learnerDetail.membershipId)
      .then((response) => {
        if (!cancelled) setLearnerDetail(response.data);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setLearnerDetailError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Unable to load learner detail.",
        );
      })
      .finally(() => {
        if (!cancelled) setLearnerDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, learnerDetail?.membershipId]);

  const hasLearnerFilters = useMemo(() => {
    return Boolean(
      learnerName || joinedFrom || joinedTo || completionValue || healthFilter !== "any",
    );
  }, [completionValue, healthFilter, joinedFrom, joinedTo, learnerName]);

  const cohortTrend = detail?.overview.cohortTrend ?? [];
  const scoreDistribution = detail?.overview.scoreDistribution ?? [];
  const scoreTotal = scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0);
  const maxTrendValue = Math.max(
    1,
    ...cohortTrend.map((point) =>
      Math.max(
        point.liveAttendancePct ?? 0,
        point.contentCompletionPct ?? 0,
        point.testScorePct ?? 0,
      ),
    ),
  );

  function clearLearnerFilters() {
    setDraftSearch("");
    setLearnerName("");
    setJoinedFrom("");
    setJoinedTo("");
    setCompletionOp("gte");
    setCompletionValue("");
    setHealthFilter("any");
    setPage(1);
    setSelectedIds([]);
  }

  function applySearch() {
    setLearnerName(draftSearch.trim());
    setPage(1);
  }

  async function copyBatchKey() {
    if (!detail?.key) return;
    try {
      await navigator.clipboard.writeText(detail.key);
      setCopiedKey(true);
      window.setTimeout(() => {
        setCopiedKey(false);
      }, 1500);
    } catch {
      setActionError("Couldn't copy batch key.");
    }
  }

  function openLearnerPanel(learner: BatchLearnerItem) {
    setRowMenuId(null);
    router.push(`/admin/reports/batches/${batchId}/learners/${learner.membershipId}`);
  }

  function closeLearnerPanel() {
    setLearnerDetail(null);
    setLearnerDetailError(null);
  }

  function openMessageModal(membershipIds?: string[]) {
    setMessageMembershipIds(membershipIds && membershipIds.length > 0 ? membershipIds : null);
    setMessageSubject("");
    setMessageBody("");
    setMessageOpen(true);
    setActionError(null);
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const trimmedName = learnerName.trim();
      const joinedFromIso = dateInputToStartIso(joinedFrom);
      const joinedToIso = dateInputToEndIso(joinedTo);
      const parsedCompletion = completionValue.trim() ? Number(completionValue.trim()) : undefined;
      await sendBatchMessage({
        batchId,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        ...(messageMembershipIds ? { membershipIds: messageMembershipIds } : {}),
        ...(!messageMembershipIds && trimmedName ? { learnerName: trimmedName } : {}),
        ...(!messageMembershipIds && joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
        ...(!messageMembershipIds && joinedToIso ? { joinedTo: joinedToIso } : {}),
        ...(!messageMembershipIds &&
        parsedCompletion != null &&
        !Number.isNaN(parsedCompletion) &&
        completionOp === "gte"
          ? { minCompletion: parsedCompletion }
          : {}),
        ...(!messageMembershipIds &&
        parsedCompletion != null &&
        !Number.isNaN(parsedCompletion) &&
        completionOp === "lte"
          ? { maxCompletion: parsedCompletion }
          : {}),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setMessageMembershipIds(null);
    } catch (messageError) {
      setActionError(
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

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const trimmedName = learnerName.trim();
      const joinedFromIso = dateInputToStartIso(joinedFrom);
      const joinedToIso = dateInputToEndIso(joinedTo);
      const response = await exportBatchReport({
        batchId,
        ...(trimmedName ? { learnerName: trimmedName } : {}),
        ...(joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
        ...(joinedToIso ? { joinedTo: joinedToIso } : {}),
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
      setActionError(
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

  function toggleSelectAll() {
    if (learners.length > 0 && selectedIds.length === learners.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(learners.map((learner) => learner.membershipId));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function moveDraftColumn(index: number, direction: -1 | 1) {
    setDraftColumns((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function toggleDraftColumn(key: BatchLearnerColumnKey) {
    setDraftColumns((current) => {
      if (current.includes(key)) {
        const next = current.filter((item) => item !== key);
        return next.length > 0 ? next : current;
      }
      return [...current, key];
    });
  }

  function goToAtRiskLearners() {
    setHealthFilter("needs_attention");
    setPage(1);
    setTab("learners");
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const linkedCourse = Boolean(detail?.courseId);

  return {
    batchId,
    formatCount,
    formatDate,
    formatDateTime,
    formatRelative,
    isStaleActivity,
    weekCaption,
    router,
    searchId,
    columnsPanelId,
    columnsRef,
    activeTab,
    detail,
    detailLoading,
    detailError,
    learners,
    learnersLoading,
    learnersError,
    page,
    setPage,
    totalPages,
    totalCount,
    draftSearch,
    setDraftSearch,
    learnerName,
    setLearnerName,
    joinedFrom,
    setJoinedFrom,
    joinedTo,
    setJoinedTo,
    completionOp,
    setCompletionOp,
    completionValue,
    setCompletionValue,
    healthFilter,
    setHealthFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    columns,
    setColumns,
    draftColumns,
    setDraftColumns,
    columnsOpen,
    setColumnsOpen,
    selectedIds,
    setSelectedIds,
    rowMenuId,
    setRowMenuId,
    busy,
    actionError,
    setActionError,
    copiedKey,
    messageOpen,
    setMessageOpen,
    messageSubject,
    setMessageSubject,
    messageBody,
    setMessageBody,
    messageMembershipIds,
    learnerDetail,
    learnerPanelTab,
    setLearnerPanelTab,
    learnerDetailLoading,
    learnerDetailError,
    passMark,
    setTab,
    loadDetail,
    loadLearners,
    hasLearnerFilters,
    cohortTrend,
    scoreDistribution,
    scoreTotal,
    maxTrendValue,
    clearLearnerFilters,
    applySearch,
    copyBatchKey,
    openLearnerPanel,
    closeLearnerPanel,
    openMessageModal,
    handleSendMessage,
    handleExport,
    toggleSelectAll,
    toggleSelect,
    moveDraftColumn,
    toggleDraftColumn,
    goToAtRiskLearners,
    rangeStart,
    rangeEnd,
    linkedCourse,
  };
}

export type BatchDetailView = ReturnType<typeof useBatchDetailReport>;

/** The view once the page has checked that detail loaded. */
export type BatchDetailViewReady = BatchDetailView & {
  detail: NonNullable<BatchDetailView["detail"]>;
};
