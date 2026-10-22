"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  SCORE_LEARNERS_DEFAULTS,
  type ScoreLearnersPayload,
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
} from "./admin-progress-score-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { type CohortDrawerMode } from "./CohortActionsDrawer";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer } from "./viewer-time";
import {
  type DetailTab,
  formatClockFor,
  formatCountFor,
  formatPctFor,
  formatSubmittedFor,
  productScoresHref,
} from "./admin-score-quiz-learners-shared";

/** The state, data loading and handlers behind AdminScoreQuizLearnersPage. */
export function useScoreQuizLearners(props: {
  assessmentId: string;
  /** The first page of learners, loaded by the server; the first browser load is skipped when present. */
  initialLearners?: ReportInitialData<ScoreLearnersPayload> | null;
}) {
  const { assessmentId, initialLearners } = props;
  const viewer = useViewerLocale();
  const formatPct = withViewer(formatPctFor, viewer);
  const formatCount = withViewer(formatCountFor, viewer);
  const formatSubmitted = withViewer(formatSubmittedFor, viewer);
  const formatClock = withViewer(formatClockFor, viewer);
  const [tab, setTab] = useState<DetailTab>("learners");
  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => initialLearners ?? null);
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [assessment, setAssessment] = useState<ScoreLearnersAssessment | null>(
    initial?.data.assessment ?? null,
  );
  const [courseId, setCourseId] = useState<string | null>(initial?.data.courseId ?? null);
  const [courseTitle, setCourseTitle] = useState<string | null>(initial?.data.courseTitle ?? null);
  const [summary, setSummary] = useState<ScoreLearnersSummary | null>(
    initial?.data.summary ?? null,
  );
  const [learners, setLearners] = useState<ScoreLearnerItem[]>(initial?.data.items ?? []);
  const [page, setPage] = useState<number>(SCORE_LEARNERS_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initial?.data.pageInfo.totalCount ?? 0);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resultStatus, setResultStatus] = useState<"" | ScoreLearnerResultStatus>("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [attemptsFilter, setAttemptsFilter] = useState<ScoreAttemptsFilter>(
    SCORE_LEARNERS_DEFAULTS.attemptsFilter,
  );
  const [view, setView] = useState<ScoreLearnerView>(SCORE_LEARNERS_DEFAULTS.view);
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
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAttemptSearch(attemptSearch.trim());
      setAttemptsPage(1);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
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

  const loadLearners = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
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
          ...(dateInputToEndIso(submittedTo)
            ? { submittedTo: dateInputToEndIso(submittedTo) }
            : {}),
          sortBy: SCORE_LEARNERS_DEFAULTS.sortBy,
          sortDir: SCORE_LEARNERS_DEFAULTS.sortDir,
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
        if (!soft) setLoading(false);
      }
    },
    [
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
    ],
  );

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

  useReportLoad(loadLearners, initial);

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
    if (parsedMinScore != null) chips.push(`Min score: ${String(parsedMinScore)}`);
    if (parsedMaxScore != null) chips.push(`Max score: ${String(parsedMaxScore)}`);
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
    viewer,
  ]);

  function openCohortDrawer(mode: CohortDrawerMode) {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  return {
    assessmentId,
    formatPct,
    formatCount,
    formatSubmitted,
    formatClock,
    tab,
    setTab,
    loading,
    error,
    busy,
    assessment,
    courseTitle,
    summary,
    learners,
    page,
    setPage,
    totalPages,
    totalCount,
    searchInput,
    setSearchInput,
    debouncedSearch,
    resultStatus,
    setResultStatus,
    minScore,
    setMinScore,
    maxScore,
    setMaxScore,
    attemptsFilter,
    setAttemptsFilter,
    view,
    setView,
    submittedFrom,
    setSubmittedFrom,
    submittedTo,
    setSubmittedTo,
    columnsOpen,
    setColumnsOpen,
    columns,
    setColumns,
    drawerOpen,
    setDrawerOpen,
    drawerMode,
    selectedIds,
    setSelectedIds,
    rowMenuId,
    setRowMenuId,
    regradeOpen,
    setRegradeOpen,
    itemAnalysis,
    belowFortyCount,
    itemsLoading,
    itemsError,
    expandedItemId,
    setExpandedItemId,
    attempts,
    attemptsLoading,
    attemptsError,
    attemptsPage,
    setAttemptsPage,
    attemptsTotalPages,
    attemptsTotalCount,
    attemptSearch,
    setAttemptSearch,
    parsedMinScore,
    parsedMaxScore,
    hasActiveFilters,
    loadLearners,
    loadItems,
    loadAttempts,
    selectedMembershipIds,
    selectedAttemptIds,
    allOnPageSelected,
    toggleSelectAllOnPage,
    toggleLearnerSelection,
    clearFilters,
    handleExport,
    handleRegrade,
    copyAttemptId,
    title,
    passMark,
    backHref,
    showingFrom,
    showingTo,
    emptyFiltered,
    filterChips,
    openCohortDrawer,
  };
}

export type ScoreQuizLearnersView = ReturnType<typeof useScoreQuizLearners>;
