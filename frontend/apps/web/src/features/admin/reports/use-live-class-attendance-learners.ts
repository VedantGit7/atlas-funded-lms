"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import type { ReportInitialDataInRange } from "../../../lib/server/report-initial-data";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchLiveClassAttendanceLearners,
  fetchLiveClassAttendanceLearnersMatrix,
  LIVE_LEARNERS_DEFAULTS,
  liveSessionsPresetRange,
  sendLiveClassAttendanceMessage,
  type LiveLearnerAttendanceColumnKey,
  type LiveLearnerAttendanceRateBand,
  type LiveLearnerLastAttendedFilter,
  type LiveLearnerListItem,
  type LiveLearnerSessionsRegisteredBand,
  type LiveLearnerSortBy,
  type LiveLearnersListSummary,
  type LiveLearnersPayload,
  type LiveLearnersMatrix,
} from "./admin-live-class-attendance-roster-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer } from "./viewer-time";
import {
  ATTENDANCE_RATE_OPTIONS,
  DEFAULT_COLUMNS,
  type DatePreset,
  EMPTY_SUMMARY,
  LAST_ATTENDED_OPTIONS,
  SESSIONS_REGISTERED_OPTIONS,
  SORT_OPTIONS,
  type ViewMode,
  formatCountFor,
  formatDateFor,
} from "./admin-live-class-attendance-learners-shared";

/** The state, data loading and handlers behind AdminLiveClassAttendanceLearnersPage. */
export function useLiveClassAttendanceLearners(props: {
  /** The first page over the last 30 days, loaded by the server; the first browser load is skipped when present. */
  initialLearners?: ReportInitialDataInRange<LiveLearnersPayload> | null;
}) {
  const { initialLearners } = props;
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatDate = withViewer(formatDateFor, viewer);
  const router = useRouter();
  const datePresetLabelId = useId();
  const columnsLabelId = useId();
  const attendanceRateLabelId = useId();
  const sessionsRegisteredLabelId = useId();
  const lastAttendedLabelId = useId();
  const sortLabelId = useId();

  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => initialLearners ?? null);
  const [loading, setLoading] = useState(initial === null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [learners, setLearners] = useState<LiveLearnerListItem[]>(initial?.data.items ?? []);
  const [summary, setSummary] = useState<LiveLearnersListSummary>(
    initial?.data.summary ?? EMPTY_SUMMARY,
  );
  const [matrix, setMatrix] = useState<LiveLearnersMatrix | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuLearnerId, setMenuLearnerId] = useState<string | null>(null);

  const [page, setPage] = useState<number>(LIVE_LEARNERS_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initial?.data.pageInfo.totalCount ?? 0);

  // The server's range when it loaded the first page, so both renders agree.
  const [initialRange] = useState(
    () => initial?.range ?? liveSessionsPresetRange(LIVE_LEARNERS_DEFAULTS.datePreset),
  );
  const [datePreset, setDatePreset] = useState<DatePreset>(LIVE_LEARNERS_DEFAULTS.datePreset);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [scheduledFrom, setScheduledFrom] = useState(initialRange.from);
  const [scheduledTo, setScheduledTo] = useState(initialRange.to);

  const [searchQ, setSearchQ] = useState("");
  const [attendanceRateBand, setAttendanceRateBand] = useState<LiveLearnerAttendanceRateBand | "">(
    "",
  );
  const [sessionsRegisteredBand, setSessionsRegisteredBand] = useState<
    LiveLearnerSessionsRegisteredBand | ""
  >("");
  const [lastAttended, setLastAttended] = useState<LiveLearnerLastAttendedFilter | "">("");
  const [sortBy, setSortBy] = useState<LiveLearnerSortBy>(LIVE_LEARNERS_DEFAULTS.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(LIVE_LEARNERS_DEFAULTS.sortDir);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [columns, setColumns] = useState<LiveLearnerAttendanceColumnKey[]>(DEFAULT_COLUMNS);

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [attendanceRateOpen, setAttendanceRateOpen] = useState(false);
  const [sessionsRegisteredOpen, setSessionsRegisteredOpen] = useState(false);
  const [lastAttendedOpen, setLastAttendedOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [remindOpen, setRemindOpen] = useState(false);
  const [remindAudience, setRemindAudience] = useState<"low_attendance" | "selected">(
    "low_attendance",
  );
  const [remindIds, setRemindIds] = useState<string[]>([]);
  const [remindSubject, setRemindSubject] = useState(
    "We noticed you've missed recent live sessions",
  );
  const [remindBody, setRemindBody] = useState(
    "Hi {{learner_name}},\n\nWe noticed your attendance on recent live sessions has been lower than expected. Please join the next scheduled session or reach out if you need support.",
  );
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);

  const datePresetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "90d"
        ? "Last 90 days"
        : datePreset === "custom"
          ? "Custom range"
          : "Last 30 days";

  const matrixFilterPayload = useMemo(() => {
    const payload: Parameters<typeof fetchLiveClassAttendanceLearnersMatrix>[0] = {};
    const trimmedQ = searchQ.trim();
    if (trimmedQ) payload.q = trimmedQ;
    const fromIso = dateInputToStartIso(scheduledFrom);
    if (fromIso) payload.scheduledFrom = fromIso;
    const toIso = dateInputToEndIso(scheduledTo);
    if (toIso) payload.scheduledTo = toIso;
    if (attendanceRateBand) payload.attendanceRateBand = attendanceRateBand;
    if (sessionsRegisteredBand) payload.sessionsRegisteredBand = sessionsRegisteredBand;
    if (lastAttended) payload.lastAttended = lastAttended;
    return payload;
  }, [
    attendanceRateBand,
    lastAttended,
    scheduledFrom,
    scheduledTo,
    searchQ,
    sessionsRegisteredBand,
  ]);
  const filterPayload = useMemo(() => {
    const payload: Parameters<typeof fetchLiveClassAttendanceLearners>[0] = {
      sortBy,
      sortDir,
      columns,
    };
    const trimmedQ = searchQ.trim();
    if (trimmedQ) payload.q = trimmedQ;
    const fromIso = dateInputToStartIso(scheduledFrom);
    if (fromIso) payload.scheduledFrom = fromIso;
    const toIso = dateInputToEndIso(scheduledTo);
    if (toIso) payload.scheduledTo = toIso;
    if (attendanceRateBand) payload.attendanceRateBand = attendanceRateBand;
    if (sessionsRegisteredBand) payload.sessionsRegisteredBand = sessionsRegisteredBand;
    if (lastAttended) payload.lastAttended = lastAttended;
    return payload;
  }, [
    attendanceRateBand,
    columns,
    lastAttended,
    scheduledFrom,
    scheduledTo,
    searchQ,
    sessionsRegisteredBand,
    sortBy,
    sortDir,
  ]);

  const hasActiveFilters =
    Boolean(searchQ.trim()) ||
    Boolean(attendanceRateBand) ||
    Boolean(sessionsRegisteredBand) ||
    Boolean(lastAttended);

  const sortLabel =
    SORT_OPTIONS.find((option) => option.sortBy === sortBy && option.sortDir === sortDir)?.label ??
    "Attendance rate ↑";

  const attendanceRateLabel =
    ATTENDANCE_RATE_OPTIONS.find((option) => option.value === attendanceRateBand)?.label ?? "Any";

  const sessionsRegisteredLabel =
    SESSIONS_REGISTERED_OPTIONS.find((option) => option.value === sessionsRegisteredBand)?.label ??
    "Any";

  const lastAttendedLabel =
    LAST_ATTENDED_OPTIONS.find((option) => option.value === lastAttended)?.label ?? "Any";

  const closeFilterMenus = useCallback(() => {
    setColumnsOpen(false);
    setAttendanceRateOpen(false);
    setSessionsRegisteredOpen(false);
    setLastAttendedOpen(false);
    setSortOpen(false);
  }, []);

  const applyDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = liveSessionsPresetRange(preset);
    setScheduledFrom(range.from);
    setScheduledTo(range.to);
    setPage(1);
  }, []);

  const loadLearners = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
      setError(null);
      try {
        const response = await fetchLiveClassAttendanceLearners({
          ...filterPayload,
          page,
        });
        setLearners(response.data.items);
        setSummary(response.data.summary);
        setTotalPages(response.data.pageInfo.totalPages);
        setTotalCount(response.data.pageInfo.totalCount);
      } catch (loadError) {
        setError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Couldn't load learners.",
        );
        setLearners([]);
        setSummary(EMPTY_SUMMARY);
      } finally {
        if (!soft) setLoading(false);
      }
    },
    [filterPayload, page],
  );

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try {
      const response = await fetchLiveClassAttendanceLearnersMatrix(matrixFilterPayload);
      setMatrix(response.data);
    } catch {
      setMatrix(null);
    } finally {
      setMatrixLoading(false);
    }
  }, [matrixFilterPayload]);

  useReportLoad(loadLearners, initial);

  useEffect(() => {
    if (viewMode === "matrix") {
      void loadMatrix();
    }
  }, [viewMode, loadMatrix]);

  useEffect(() => {
    if (!menuLearnerId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-learner-menu]")) {
        setMenuLearnerId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuLearnerId]);

  function openLearner(learner: LiveLearnerListItem) {
    router.push(`/admin/reports/live-class-attendance/learners/${learner.membershipId}`);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const visibleIds = learners.map((learner) => learner.membershipId);
      const allSelected = visibleIds.every((id) => current.has(id));
      if (allSelected) {
        const next = new Set(current);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(current);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }

  function toggleColumn(key: LiveLearnerAttendanceColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((col) => col !== key);
      }
      return [...current, key];
    });
    setPage(1);
  }

  function clearFilters() {
    setSearchQ("");
    setAttendanceRateBand("");
    setSessionsRegisteredBand("");
    setLastAttended("");
    setPage(1);
  }

  function resetFiltersAndRange() {
    applyDatePreset("30d");
    clearFilters();
  }

  function handleSortHeader(nextSortBy: LiveLearnerSortBy) {
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDir(
        nextSortBy === "attendance_rate" || nextSortBy === "last_attended" ? "asc" : "desc",
      );
    }
    setPage(1);
  }

  function openLowAttendanceMessage() {
    setRemindAudience("low_attendance");
    setRemindIds([]);
    setRemindError(null);
    setRemindOpen(true);
  }

  function openSelectedMessage(ids: string[]) {
    setRemindAudience("selected");
    setRemindIds(ids);
    setRemindError(null);
    setRemindOpen(true);
  }

  async function handleSendMessage() {
    if (!remindSubject.trim() || !remindBody.trim()) return;
    if (remindAudience === "selected" && remindIds.length === 0) return;

    setRemindBusy(true);
    setRemindError(null);
    try {
      await sendLiveClassAttendanceMessage({
        audience: remindAudience,
        ...(remindAudience === "selected" ? { membershipIds: remindIds } : {}),
        subject: remindSubject.trim(),
        message: remindBody.trim(),
        channels: ["email", "in_app"],
      });
      setRemindOpen(false);
      setSelectedIds(new Set());
    } catch (sendError) {
      setRemindError(
        sendError instanceof ClientApiError
          ? sendError.message
          : sendError instanceof Error
            ? sendError.message
            : "Couldn't send reminder.",
      );
    } finally {
      setRemindBusy(false);
    }
  }

  const remindCount =
    remindAudience === "selected"
      ? remindIds.length
      : summary.learnersRegistered > 0
        ? Math.max(0, summary.learnersRegistered - summary.perfectAttendanceCount)
        : 0;

  const remindTitle =
    remindAudience === "low_attendance" ? "Low-attendance learners" : "Selected learners";

  function columnVisible(key: LiveLearnerAttendanceColumnKey): boolean {
    return columns.includes(key);
  }

  return {
    formatCount,
    formatDate,
    datePresetLabelId,
    columnsLabelId,
    attendanceRateLabelId,
    sessionsRegisteredLabelId,
    lastAttendedLabelId,
    sortLabelId,
    loading,
    matrixLoading,
    error,
    learners,
    summary,
    matrix,
    selectedIds,
    setSelectedIds,
    menuLearnerId,
    setMenuLearnerId,
    page,
    setPage,
    totalPages,
    totalCount,
    datePreset,
    dateMenuOpen,
    setDateMenuOpen,
    scheduledFrom,
    setScheduledFrom,
    scheduledTo,
    setScheduledTo,
    searchQ,
    setSearchQ,
    attendanceRateBand,
    setAttendanceRateBand,
    sessionsRegisteredBand,
    setSessionsRegisteredBand,
    lastAttended,
    setLastAttended,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    viewMode,
    setViewMode,
    columns,
    columnsOpen,
    setColumnsOpen,
    attendanceRateOpen,
    setAttendanceRateOpen,
    sessionsRegisteredOpen,
    setSessionsRegisteredOpen,
    lastAttendedOpen,
    setLastAttendedOpen,
    sortOpen,
    setSortOpen,
    remindOpen,
    setRemindOpen,
    remindSubject,
    setRemindSubject,
    remindBody,
    setRemindBody,
    remindBusy,
    remindError,
    datePresetLabel,
    hasActiveFilters,
    sortLabel,
    attendanceRateLabel,
    sessionsRegisteredLabel,
    lastAttendedLabel,
    closeFilterMenus,
    applyDatePreset,
    loadLearners,
    openLearner,
    toggleSelected,
    toggleSelectAllVisible,
    toggleColumn,
    clearFilters,
    resetFiltersAndRange,
    handleSortHeader,
    openLowAttendanceMessage,
    openSelectedMessage,
    handleSendMessage,
    remindCount,
    remindTitle,
    columnVisible,
  };
}

export type LiveClassAttendanceLearnersView = ReturnType<typeof useLiveClassAttendanceLearners>;
