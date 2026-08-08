"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyticsAlertErrorClassName,
  analyticsExportButtonClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  LIVE_ATTENDANCE_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportLiveClassAttendanceReport,
  fetchLiveClassSessionAttendees,
  fetchLiveClassSessionDetail,
  fetchLiveClassSessionsRoster,
  type LiveAttendanceColumnKey,
  type LiveAttendeeItem,
  type LiveSessionDetail,
  type LiveSessionListItem,
} from "./admin-live-class-attendance-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type DrillLevel = "sessions" | "detail";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminLiveClassAttendanceRosterPage() {
  const [level, setLevel] = useState<DrillLevel>("sessions");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<LiveSessionListItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<LiveSessionListItem | null>(null);
  const [detail, setDetail] = useState<LiveSessionDetail | null>(null);
  const [attendees, setAttendees] = useState<LiveAttendeeItem[]>([]);

  const [page, setPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(0);

  const [searchQ, setSearchQ] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [email, setEmail] = useState("");
  const [attendeeStatus, setAttendeeStatus] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [sortBy, setSortBy] = useState("joined_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columns, setColumns] = useState<LiveAttendanceColumnKey[]>(
    LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => column.key),
  );

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassSessionsRoster({
        q: searchQ.trim() || undefined,
        status: sessionStatus || undefined,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        page: sessionsPage,
      });
      setSessions(response.data.items);
      setSessionsTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load live classes.",
      );
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [searchQ, sessionStatus, sessionsPage, startedFrom, startedTo]);

  const loadDetail = useCallback(async () => {
    if (!selectedSession) return;
    setLoading(true);
    setError(null);
    try {
      const [detailResponse, attendeesResponse] = await Promise.all([
        fetchLiveClassSessionDetail(selectedSession.id),
        fetchLiveClassSessionAttendees(selectedSession.id, {
          learnerName: learnerName.trim() || undefined,
          email: email.trim() || undefined,
          status: attendeeStatus || undefined,
          joinedFrom: dateInputToStartIso(joinedFrom),
          joinedTo: dateInputToEndIso(joinedTo),
          sortBy,
          sortDir,
          columns,
          page,
        }),
      ]);
      setDetail(detailResponse.data);
      setAttendees(attendeesResponse.data.items);
      setTotalCount(attendeesResponse.data.pageInfo.totalCount);
      setTotalPages(attendeesResponse.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load live class attendance.",
      );
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [
    attendeeStatus,
    columns,
    email,
    joinedFrom,
    joinedTo,
    learnerName,
    page,
    selectedSession,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    if (level === "sessions") {
      void loadSessions();
      return;
    }
    void loadDetail();
  }, [level, loadDetail, loadSessions]);

  function openSession(session: LiveSessionListItem) {
    setSelectedSession(session);
    setDetail(null);
    setAttendees([]);
    setPage(1);
    setLearnerName("");
    setEmail("");
    setAttendeeStatus("");
    setJoinedFrom("");
    setJoinedTo("");
    setLevel("detail");
  }

  function goBack() {
    setSelectedSession(null);
    setDetail(null);
    setAttendees([]);
    setLevel("sessions");
  }

  async function handleExport() {
    if (!selectedSession) return;
    setBusy(true);
    setError(null);
    try {
      const response = await exportLiveClassAttendanceReport({
        sessionId: selectedSession.id,
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

  function toggleColumn(key: LiveAttendanceColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={generalSettingsPageTitleClassName}>Live Class Attendance</h1>
        <p className={generalSettingsPageDescClassName}>
          Review live classes with duration and attendance, then open attendee details, filter by
          name or email, and export CSV.
        </p>
      </div>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      {level === "detail" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghostButtonClassName} onClick={goBack}>
            Back
          </button>
          <p className="text-sm text-neutral-600">
            {detail?.title ?? selectedSession?.title}
          </p>
        </div>
      ) : null}

      {level === "sessions" ? (
        <section className={generalSettingsFormCardClassName}>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              Search live classes
              <input
                className={fieldClassName}
                value={searchQ}
                onChange={(event) => setSearchQ(event.target.value)}
                placeholder="Session title"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Status
              <select
                className={fieldClassName}
                value={sessionStatus}
                onChange={(event) => setSessionStatus(event.target.value)}
              >
                <option value="">All</option>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              From
              <input
                type="date"
                className={fieldClassName}
                value={startedFrom}
                onChange={(event) => setStartedFrom(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              To
              <input
                type="date"
                className={fieldClassName}
                value={startedTo}
                onChange={(event) => setStartedTo(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                if (sessionsPage !== 1) {
                  setSessionsPage(1);
                } else {
                  void loadSessions();
                }
              }}
            >
              Search
            </button>
          </div>
          <div className={analyticsTableShellClassName}>
            {loading ? (
              <p className="p-4 text-sm text-neutral-600">Loading…</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-4 py-3">Live class</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                        No live classes found. Create sessions from Live Sessions, then check in
                        attendees to populate this report.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((session) => (
                      <tr
                        key={session.id}
                        className={`${analyticsTableRowClassName} cursor-pointer`}
                        onClick={() => openSession(session)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{session.title}</div>
                          <div className="text-xs text-neutral-500">
                            {titleCase(session.status)}
                            {session.courseTitle ? ` · ${session.courseTitle}` : ""}
                            {session.batchName ? ` · ${session.batchName}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {formatDate(session.startedAt ?? session.scheduledAt)}
                        </td>
                        <td className="px-4 py-3">{formatDuration(session.durationSeconds)}</td>
                        <td className="px-4 py-3">
                          {session.attendanceCount}
                          <span className="text-xs text-neutral-500">
                            {" "}
                            / {session.registeredCount}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          {sessionsTotalPages > 1 ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={sessionsPage <= 1 || loading}
                onClick={() => setSessionsPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">
                Page {sessionsPage} of {sessionsTotalPages}
              </span>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={sessionsPage >= sessionsTotalPages || loading}
                onClick={() => setSessionsPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {level === "detail" && selectedSession ? (
        <>
          <section className={generalSettingsFormCardClassName}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Session insights</h2>
                <p className="text-sm text-neutral-600">
                  Started {formatDate(detail?.startedAt ?? selectedSession.startedAt)} · Ended{" "}
                  {formatDate(detail?.endedAt ?? selectedSession.endedAt)}
                </p>
              </div>
              <button
                type="button"
                className={analyticsExportButtonClassName}
                disabled={busy || loading}
                onClick={() => void handleExport()}
              >
                Export CSV
              </button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Duration</p>
                <p className="text-xl font-semibold">
                  {formatDuration(detail?.durationSeconds ?? selectedSession.durationSeconds)}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Attendance</p>
                <p className="text-xl font-semibold">
                  {detail?.attendanceCount ?? selectedSession.attendanceCount}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Registered</p>
                <p className="text-xl font-semibold">
                  {detail?.registeredCount ?? selectedSession.registeredCount}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Avg attend time</p>
                <p className="text-xl font-semibold">
                  {formatDuration(detail?.avgDurationSeconds)}
                </p>
              </div>
            </div>
          </section>

          <section className={generalSettingsFormCardClassName}>
            <div className="mb-3">
              <h2 className="text-lg font-semibold">Attendees</h2>
              <p className="text-sm text-neutral-600">
                {totalCount} record{totalCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                Name
                <input
                  className={fieldClassName}
                  value={learnerName}
                  onChange={(event) => setLearnerName(event.target.value)}
                  placeholder="Learner name"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Email
                <input
                  className={fieldClassName}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Learner email"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Status
                <select
                  className={fieldClassName}
                  value={attendeeStatus}
                  onChange={(event) => setAttendeeStatus(event.target.value)}
                >
                  <option value="">All</option>
                  <option value="attended">Attended</option>
                  <option value="registered">Registered</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Joined from
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedFrom}
                  onChange={(event) => setJoinedFrom(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Joined to
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedTo}
                  onChange={(event) => setJoinedTo(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Sort
                <select
                  className={fieldClassName}
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="joined_at">Joined</option>
                  <option value="left_at">Left</option>
                  <option value="learner_name">Name</option>
                  <option value="email">Email</option>
                  <option value="status">Status</option>
                  <option value="duration_seconds">Duration</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Direction
                <select
                  className={fieldClassName}
                  value={sortDir}
                  onChange={(event) =>
                    setSortDir(event.target.value === "asc" ? "asc" : "desc")
                  }
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </label>
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  setPage(1);
                  void loadDetail();
                }}
              >
                Apply filters
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {LIVE_ATTENDANCE_COLUMN_OPTIONS.map((column) => {
                const checked = columns.includes(column.key);
                return (
                  <label
                    key={column.key}
                    className="inline-flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>

            <div className={analyticsTableShellClassName}>
              {loading && attendees.length === 0 ? (
                <p className="p-4 text-sm text-neutral-600">Loading…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className={analyticsTableHeadClassName}>
                    <tr>
                      {columns.includes("learner_name") ? (
                        <th className="px-4 py-3">Name</th>
                      ) : null}
                      {columns.includes("email") ? <th className="px-4 py-3">Email</th> : null}
                      {columns.includes("status") ? (
                        <th className="px-4 py-3">Status</th>
                      ) : null}
                      {columns.includes("joined_at") ? (
                        <th className="px-4 py-3">Joined</th>
                      ) : null}
                      {columns.includes("left_at") ? <th className="px-4 py-3">Left</th> : null}
                      {columns.includes("duration_seconds") ? (
                        <th className="px-4 py-3">Duration</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-6 text-neutral-500"
                          colSpan={Math.max(1, columns.length)}
                        >
                          No attendees match these filters.
                        </td>
                      </tr>
                    ) : (
                      attendees.map((attendee) => (
                        <tr key={attendee.id} className={analyticsTableRowClassName}>
                          {columns.includes("learner_name") ? (
                            <td className="px-4 py-3 font-medium">
                              {attendee.learnerName ?? "—"}
                            </td>
                          ) : null}
                          {columns.includes("email") ? (
                            <td className="px-4 py-3">{attendee.email ?? "—"}</td>
                          ) : null}
                          {columns.includes("status") ? (
                            <td className="px-4 py-3">{titleCase(attendee.status)}</td>
                          ) : null}
                          {columns.includes("joined_at") ? (
                            <td className="px-4 py-3 text-xs">
                              {formatDate(attendee.joinedAt)}
                            </td>
                          ) : null}
                          {columns.includes("left_at") ? (
                            <td className="px-4 py-3 text-xs">{formatDate(attendee.leftAt)}</td>
                          ) : null}
                          {columns.includes("duration_seconds") ? (
                            <td className="px-4 py-3">
                              {formatDuration(attendee.durationSeconds)}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 ? (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
