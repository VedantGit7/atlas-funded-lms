"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  LIVE_ATTENDANCE_COLUMN_OPTIONS,
  LIVE_SESSION_ATTENDEES_DEFAULTS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportLiveClassAttendanceReport,
  fetchLiveClassSessionAttendees,
  fetchLiveClassSessionDetail,
  sendLiveClassAttendanceMessage,
  type LiveAttendanceColumnKey,
  type LiveAttendeeItem,
  type LiveSessionAttendeesPayload,
  type LiveSessionDetail,
} from "./admin-live-class-attendance-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer } from "./viewer-time";
import {
  type MessageAudience,
  PAGE_SIZE,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  type SortBy,
  type SortDir,
  attendanceRate,
  coveragePct,
  defaultMessageBody,
  defaultRegistrantBody,
  errMsg,
  formatCountFor,
  formatDateFor,
  formatTimeOnlyFor,
  isCancelledStatus,
  isScheduledStatus,
  parseSortValue,
} from "./admin-live-class-attendance-session-shared";

/** The state, data loading and handlers behind AdminLiveClassAttendanceSessionDetailPage. */
export function useLiveClassAttendanceSession(props: {
  sessionId: string;
  /** The session, loaded by the server; the first browser load is skipped when present. */
  initialDetail?: ReportInitialData<LiveSessionDetail> | null;
  /** The first page of attendees, loaded by the server alongside the session. */
  initialAttendees?: ReportInitialData<LiveSessionAttendeesPayload> | null;
}) {
  const { sessionId, initialDetail, initialAttendees } = props;
  const viewer = useViewerLocale();
  const formatDate = withViewer(formatDateFor, viewer);
  const formatTimeOnly = withViewer(formatTimeOnlyFor, viewer);
  const formatCount = withViewer(formatCountFor, viewer);
  const router = useRouter();
  const searchParams = useSearchParams();
  const columnsLabelId = useId();
  const statusLabelId = useId();
  const sortLabelId = useId();
  const autoMessageHandled = useRef(false);

  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => ({
    detail: initialDetail ?? null,
    attendees: initialAttendees ?? null,
  }));
  const [detail, setDetail] = useState<LiveSessionDetail | null>(initial.detail?.data ?? null);
  const [attendees, setAttendees] = useState<LiveAttendeeItem[]>(
    initial.attendees?.data.items ?? [],
  );
  const [page, setPage] = useState<number>(LIVE_SESSION_ATTENDEES_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial.attendees?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initial.attendees?.data.pageInfo.totalCount ?? 0);

  const [loading, setLoading] = useState(initial.detail === null);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [draftLearnerName, setDraftLearnerName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftJoinedFrom, setDraftJoinedFrom] = useState("");
  const [draftJoinedTo, setDraftJoinedTo] = useState("");
  const [draftSortValue, setDraftSortValue] = useState("status:asc");

  const [learnerName, setLearnerName] = useState("");
  const [email, setEmail] = useState("");
  const [attendeeStatus, setAttendeeStatus] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>(LIVE_SESSION_ATTENDEES_DEFAULTS.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(LIVE_SESSION_ATTENDEES_DEFAULTS.sortDir);

  const [columns, setColumns] = useState<LiveAttendanceColumnKey[]>(
    LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageAudience, setMessageAudience] = useState<MessageAudience>("absentees");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const hasAttendeeFilters = Boolean(
    learnerName.trim() ||
    email.trim() ||
    attendeeStatus ||
    joinedFrom ||
    joinedTo ||
    sortBy !== "status" ||
    sortDir !== "asc",
  );

  const loadDetail = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
      setError(null);
      try {
        const response = await fetchLiveClassSessionDetail(sessionId);
        setDetail(response.data);
      } catch (loadError) {
        setDetail(null);
        setError(errMsg(loadError, "Couldn't load session attendance."));
      } finally {
        if (!soft) setLoading(false);
      }
    },
    [sessionId],
  );

  const loadAttendees = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setAttendeesLoading(true);
      setError(null);
      try {
        const response = await fetchLiveClassSessionAttendees(sessionId, {
          learnerName: learnerName.trim() || undefined,
          email: email.trim() || undefined,
          status: attendeeStatus || undefined,
          joinedFrom: dateInputToStartIso(joinedFrom),
          joinedTo: dateInputToEndIso(joinedTo),
          sortBy,
          sortDir,
          columns,
          page,
        });
        setAttendees(response.data.items);
        setTotalCount(response.data.pageInfo.totalCount);
        setTotalPages(response.data.pageInfo.totalPages);
        setSelectedIds((current) =>
          current.filter((id) => response.data.items.some((row) => row.membershipId === id)),
        );
      } catch (loadError) {
        setAttendees([]);
        setTotalCount(0);
        setTotalPages(0);
        setError(errMsg(loadError, "Couldn't load attendees."));
      } finally {
        if (!soft) setAttendeesLoading(false);
      }
    },
    [
      attendeeStatus,
      columns,
      email,
      joinedFrom,
      joinedTo,
      learnerName,
      page,
      sessionId,
      sortBy,
      sortDir,
    ],
  );

  useReportLoad(loadDetail, initial.detail);
  useReportLoad(loadAttendees, initial.attendees);

  const cancelled = detail ? isCancelledStatus(detail.status) : false;
  const scheduled = detail ? isScheduledStatus(detail.status) : false;
  const rate = detail ? attendanceRate(detail.attendanceCount, detail.registeredCount) : null;
  const avgCoverage =
    detail?.avgCoveragePct ?? coveragePct(detail?.avgDurationSeconds, detail?.durationSeconds);
  const plannedMinutes =
    detail?.durationSeconds != null ? Math.round(detail.durationSeconds / 60) : null;
  const showTimeline = !!detail && !cancelled && !scheduled && detail.timeline.points.length > 0;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === draftStatus)?.label ?? "All statuses";
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === draftSortValue)?.label ??
    "Status (absentees first)";

  const messageCount = useMemo(() => {
    if (messageAudience === "selected") return messageIds.length;
    if (messageAudience === "registrants") return detail?.registeredCount ?? 0;
    return detail?.absentCount ?? 0;
  }, [detail?.absentCount, detail?.registeredCount, messageAudience, messageIds.length]);

  function applyFilters(overrides?: { status?: string; page?: number }) {
    const nextStatus = overrides?.status ?? draftStatus;
    const parsed = parseSortValue(draftSortValue);
    setLearnerName(draftLearnerName.trim());
    setEmail(draftEmail.trim());
    setAttendeeStatus(nextStatus);
    setDraftStatus(nextStatus);
    setJoinedFrom(draftJoinedFrom);
    setJoinedTo(draftJoinedTo);
    setSortBy(parsed.sortBy);
    setSortDir(parsed.sortDir);
    setPage(overrides?.page ?? 1);
    setSelectedIds([]);
  }

  function filterAbsentees() {
    setDraftStatus("absent");
    applyFilters({ status: "absent", page: 1 });
  }

  function toggleColumn(key: LiveAttendanceColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  function toggleSelectAll() {
    if (attendees.length === 0) return;
    if (selectedIds.length === attendees.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(attendees.map((row) => row.membershipId));
  }

  function toggleRow(membershipId: string) {
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportLiveClassAttendanceReport({
        sessionId,
        learnerName: learnerName.trim() || undefined,
        email: email.trim() || undefined,
        status: attendeeStatus || undefined,
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
      setActionError(errMsg(exportError, "Unable to export report."));
    } finally {
      setBusy(false);
    }
  }

  function openMessageDrawer(audience: MessageAudience, membershipIds?: string[]) {
    if (!detail) return;
    const title = detail.title;
    setMessageAudience(audience);
    setMessageIds(membershipIds ?? []);
    setMessageError(null);
    setChannelEmail(true);
    setChannelInApp(true);
    if (audience === "registrants") {
      setMessageSubject(`Reminder: ${title}`);
      setMessageBody(defaultRegistrantBody(title));
    } else {
      setMessageSubject(`You missed: ${title}`);
      setMessageBody(defaultMessageBody(title));
    }
    setMessageOpen(true);
  }

  useEffect(() => {
    if (!detail || autoMessageHandled.current) return;
    if (searchParams.get("message") !== "absentees") return;
    autoMessageHandled.current = true;

    const cancelledSession = isCancelledStatus(detail.status);
    if (!cancelledSession && detail.absentCount > 0) {
      setMessageAudience("absentees");
      setMessageIds([]);
      setMessageError(null);
      setChannelEmail(true);
      setChannelInApp(true);
      setMessageSubject(`You missed: ${detail.title}`);
      setMessageBody(defaultMessageBody(detail.title));
      setMessageOpen(true);
      setDraftStatus("absent");
      setAttendeeStatus("absent");
      setPage(1);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("message");
    const query = params.toString();
    router.replace(
      query
        ? `/admin/reports/live-class-attendance/${sessionId}?${query}`
        : `/admin/reports/live-class-attendance/${sessionId}`,
    );
  }, [detail, router, searchParams, sessionId]);

  async function handleSendMessage(options?: { sendTestToSelf?: boolean }) {
    if (!detail || !messageSubject.trim() || !messageBody.trim()) return;
    if (!channelEmail && !channelInApp) return;

    const channels: Array<"email" | "in_app"> = [];
    if (channelEmail) channels.push("email");
    if (channelInApp) channels.push("in_app");

    setMessageBusy(true);
    setMessageError(null);
    setActionError(null);
    try {
      await sendLiveClassAttendanceMessage({
        sessionId,
        audience: messageAudience,
        ...(messageAudience === "selected" ? { membershipIds: messageIds } : {}),
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        channels,
        ...(options?.sendTestToSelf ? { sendTestToSelf: true } : {}),
      });
      if (!options?.sendTestToSelf) {
        setMessageOpen(false);
        setMessageSubject("");
        setMessageBody("");
        setMessageIds([]);
        if (messageAudience === "selected") setSelectedIds([]);
      }
    } catch (sendError) {
      setMessageError(errMsg(sendError, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  async function retryAll() {
    await Promise.all([loadDetail(), loadAttendees()]);
  }

  return {
    sessionId,
    formatDate,
    formatTimeOnly,
    formatCount,
    router,
    columnsLabelId,
    statusLabelId,
    sortLabelId,
    detail,
    attendees,
    page,
    setPage,
    totalPages,
    totalCount,
    loading,
    attendeesLoading,
    busy,
    error,
    setError,
    actionError,
    setActionError,
    draftLearnerName,
    setDraftLearnerName,
    draftEmail,
    setDraftEmail,
    draftStatus,
    setDraftStatus,
    draftJoinedFrom,
    setDraftJoinedFrom,
    draftJoinedTo,
    setDraftJoinedTo,
    draftSortValue,
    setDraftSortValue,
    columns,
    columnsOpen,
    setColumnsOpen,
    statusOpen,
    setStatusOpen,
    sortOpen,
    setSortOpen,
    selectedIds,
    setSelectedIds,
    messageOpen,
    setMessageOpen,
    messageAudience,
    messageSubject,
    setMessageSubject,
    messageBody,
    setMessageBody,
    channelEmail,
    setChannelEmail,
    channelInApp,
    setChannelInApp,
    messageBusy,
    messageError,
    setMessageError,
    hasAttendeeFilters,
    cancelled,
    scheduled,
    rate,
    avgCoverage,
    plannedMinutes,
    showTimeline,
    rangeStart,
    rangeEnd,
    statusLabel,
    sortLabel,
    messageCount,
    applyFilters,
    filterAbsentees,
    toggleColumn,
    toggleSelectAll,
    toggleRow,
    handleExport,
    openMessageDrawer,
    handleSendMessage,
    retryAll,
  };
}

export type LiveClassAttendanceSessionView = ReturnType<typeof useLiveClassAttendanceSession>;

/** The view once the page has checked that detail loaded. */
export type LiveClassAttendanceSessionViewReady = LiveClassAttendanceSessionView & {
  detail: NonNullable<LiveClassAttendanceSessionView["detail"]>;
};
