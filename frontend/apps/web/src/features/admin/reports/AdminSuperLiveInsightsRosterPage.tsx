"use client";

import Link from "next/link";
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
  SUPER_LIVE_INSIGHT_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportSuperLiveInsightsReport,
  fetchSuperLiveInsightDetail,
  fetchSuperLiveInsightsRoster,
  type SuperLiveInsightColumnKey,
  type SuperLiveInsightItem,
  type SuperLiveInsightsSummary,
} from "./admin-super-live-insights-roster-api";
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
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs)}s`;
  return `${String(secs)}s`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function AdminSuperLiveInsightsRosterPage() {
  const [level, setLevel] = useState<DrillLevel>("sessions");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SuperLiveInsightItem[]>([]);
  const [summary, setSummary] = useState<SuperLiveInsightsSummary | null>(null);
  const [selectedSession, setSelectedSession] = useState<SuperLiveInsightItem | null>(null);
  const [detail, setDetail] = useState<SuperLiveInsightItem | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [searchQ, setSearchQ] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [minAttended, setMinAttended] = useState("");
  const [sortBy, setSortBy] = useState("scheduled_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<SuperLiveInsightColumnKey[]>([
    "title",
    "status",
    "scheduled_at",
    "duration_seconds",
    "attended_count",
    "registered_count",
    "attendance_rate",
    "avg_duration_seconds",
  ]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const min =
        minAttended.trim().length > 0 && Number.isFinite(Number(minAttended))
          ? Number(minAttended)
          : undefined;
      const response = await fetchSuperLiveInsightsRoster({
        q: searchQ.trim() || undefined,
        status: sessionStatus || undefined,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        minAttended: min,
        sortBy,
        sortDir,
        columns,
        page,
      });
      setSessions(response.data.items);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load Super Live Insights.",
      );
      setSessions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [columns, minAttended, page, searchQ, sessionStatus, sortBy, sortDir, startedFrom, startedTo]);

  const loadDetail = useCallback(async () => {
    if (!selectedSession) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSuperLiveInsightDetail(selectedSession.id);
      setDetail(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load session insights.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (level === "sessions") {
      void loadSessions();
      return;
    }
    void loadDetail();
  }, [level, loadDetail, loadSessions]);

  function openSession(session: SuperLiveInsightItem) {
    setSelectedSession(session);
    setDetail(null);
    setLevel("detail");
  }

  function goBack() {
    setSelectedSession(null);
    setDetail(null);
    setLevel("sessions");
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const min =
        minAttended.trim().length > 0 && Number.isFinite(Number(minAttended))
          ? Number(minAttended)
          : undefined;
      const response = await exportSuperLiveInsightsReport({
        sessionId: selectedSession?.id,
        q: searchQ.trim() || undefined,
        status: sessionStatus || undefined,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        minAttended: min,
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

  function toggleColumn(key: SuperLiveInsightColumnKey) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  const active = detail ?? selectedSession;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={generalSettingsPageTitleClassName}>Super Live Insights</h1>
        <p className={generalSettingsPageDescClassName}>
          Review live session engagement metrics — duration, attended vs registered, attendance rate
          — then export CSV or open the attendance roster.
        </p>
      </div>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      {level === "detail" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghostButtonClassName} onClick={goBack}>
            Back
          </button>
          <p className="text-sm text-neutral-600">{active?.title}</p>
        </div>
      ) : null}

      {level === "sessions" ? (
        <>
          <section className={generalSettingsFormCardClassName}>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Sessions</p>
                <p className="text-xl font-semibold">{summary?.sessionCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Total attended</p>
                <p className="text-xl font-semibold">{summary?.totalAttended ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Total rostered</p>
                <p className="text-xl font-semibold">{summary?.totalRegistered ?? 0}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Avg attendance</p>
                <p className="text-xl font-semibold">{formatRate(summary?.avgAttendanceRate)}</p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                Search
                <input
                  className={fieldClassName}
                  value={searchQ}
                  onChange={(event) => {
                    setSearchQ(event.target.value);
                  }}
                  placeholder="Session title"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Status
                <select
                  className={fieldClassName}
                  value={sessionStatus}
                  onChange={(event) => {
                    setSessionStatus(event.target.value);
                  }}
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
                  onChange={(event) => {
                    setStartedFrom(event.target.value);
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                To
                <input
                  type="date"
                  className={fieldClassName}
                  value={startedTo}
                  onChange={(event) => {
                    setStartedTo(event.target.value);
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Min attended
                <input
                  className={fieldClassName}
                  value={minAttended}
                  onChange={(event) => {
                    setMinAttended(event.target.value);
                  }}
                  placeholder="0"
                  inputMode="numeric"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Sort
                <select
                  className={fieldClassName}
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                  }}
                >
                  <option value="scheduled_at">Scheduled</option>
                  <option value="started_at">Started</option>
                  <option value="title">Title</option>
                  <option value="attended_count">Attended</option>
                  <option value="registered_count">Registered</option>
                  <option value="duration_seconds">Duration</option>
                  <option value="attendance_rate">Attendance %</option>
                  <option value="avg_duration_seconds">Avg duration</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Direction
                <select
                  className={fieldClassName}
                  value={sortDir}
                  onChange={(event) => {
                    setSortDir(event.target.value === "asc" ? "asc" : "desc");
                  }}
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </label>
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  if (page !== 1) setPage(1);
                  else void loadSessions();
                }}
              >
                Apply
              </button>
              <button
                type="button"
                className={analyticsExportButtonClassName}
                disabled={busy || loading}
                onClick={() => void handleExport()}
              >
                Export CSV
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {SUPER_LIVE_INSIGHT_COLUMN_OPTIONS.map((column) => {
                const checked = columns.includes(column.key);
                return (
                  <label
                    key={column.key}
                    className="inline-flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>

            <div className={analyticsTableShellClassName}>
              {loading ? (
                <p className="p-4 text-sm text-neutral-600">Loading…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className={analyticsTableHeadClassName}>
                    <tr>
                      {columns.includes("title") ? <th className="px-4 py-3">Live class</th> : null}
                      {columns.includes("status") ? <th className="px-4 py-3">Status</th> : null}
                      {columns.includes("course_title") ? (
                        <th className="px-4 py-3">Course</th>
                      ) : null}
                      {columns.includes("batch_name") ? <th className="px-4 py-3">Batch</th> : null}
                      {columns.includes("scheduled_at") ? (
                        <th className="px-4 py-3">Scheduled</th>
                      ) : null}
                      {columns.includes("started_at") ? (
                        <th className="px-4 py-3">Started</th>
                      ) : null}
                      {columns.includes("ended_at") ? <th className="px-4 py-3">Ended</th> : null}
                      {columns.includes("duration_seconds") ? (
                        <th className="px-4 py-3">Duration</th>
                      ) : null}
                      {columns.includes("attended_count") ? (
                        <th className="px-4 py-3">Attended</th>
                      ) : null}
                      {columns.includes("registered_count") ? (
                        <th className="px-4 py-3">Registered</th>
                      ) : null}
                      {columns.includes("absent_count") ? (
                        <th className="px-4 py-3">Absent</th>
                      ) : null}
                      {columns.includes("total_count") ? (
                        <th className="px-4 py-3">Total</th>
                      ) : null}
                      {columns.includes("avg_duration_seconds") ? (
                        <th className="px-4 py-3">Avg duration</th>
                      ) : null}
                      {columns.includes("attendance_rate") ? (
                        <th className="px-4 py-3">Attendance %</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-6 text-neutral-500"
                          colSpan={Math.max(1, columns.length)}
                        >
                          No live sessions found. Create sessions and check in attendees to populate
                          engagement metrics.
                        </td>
                      </tr>
                    ) : (
                      sessions.map((session) => (
                        <tr
                          key={session.id}
                          className={`${analyticsTableRowClassName} cursor-pointer`}
                          onClick={() => {
                            openSession(session);
                          }}
                        >
                          {columns.includes("title") ? (
                            <td className="px-4 py-3 font-medium">{session.title}</td>
                          ) : null}
                          {columns.includes("status") ? (
                            <td className="px-4 py-3">{titleCase(session.status)}</td>
                          ) : null}
                          {columns.includes("course_title") ? (
                            <td className="px-4 py-3">{session.courseTitle ?? "—"}</td>
                          ) : null}
                          {columns.includes("batch_name") ? (
                            <td className="px-4 py-3">{session.batchName ?? "—"}</td>
                          ) : null}
                          {columns.includes("scheduled_at") ? (
                            <td className="px-4 py-3 text-xs">{formatDate(session.scheduledAt)}</td>
                          ) : null}
                          {columns.includes("started_at") ? (
                            <td className="px-4 py-3 text-xs">{formatDate(session.startedAt)}</td>
                          ) : null}
                          {columns.includes("ended_at") ? (
                            <td className="px-4 py-3 text-xs">{formatDate(session.endedAt)}</td>
                          ) : null}
                          {columns.includes("duration_seconds") ? (
                            <td className="px-4 py-3">{formatDuration(session.durationSeconds)}</td>
                          ) : null}
                          {columns.includes("attended_count") ? (
                            <td className="px-4 py-3">{session.attendedCount}</td>
                          ) : null}
                          {columns.includes("registered_count") ? (
                            <td className="px-4 py-3">{session.registeredCount}</td>
                          ) : null}
                          {columns.includes("absent_count") ? (
                            <td className="px-4 py-3">{session.absentCount}</td>
                          ) : null}
                          {columns.includes("total_count") ? (
                            <td className="px-4 py-3">{session.totalCount}</td>
                          ) : null}
                          {columns.includes("avg_duration_seconds") ? (
                            <td className="px-4 py-3">
                              {formatDuration(session.avgDurationSeconds)}
                            </td>
                          ) : null}
                          {columns.includes("attendance_rate") ? (
                            <td className="px-4 py-3">{formatRate(session.attendanceRate)}</td>
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
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
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
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {level === "detail" && active ? (
        <section className={generalSettingsFormCardClassName}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Session engagement</h2>
              <p className="text-sm text-neutral-600">
                {titleCase(active.status)}
                {active.courseTitle ? ` · ${active.courseTitle}` : ""}
                {active.batchName ? ` · ${active.batchName}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/reports/live-class-attendance" className={ghostButtonClassName}>
                Open attendance roster
              </Link>
              <button
                type="button"
                className={analyticsExportButtonClassName}
                disabled={busy || loading}
                onClick={() => void handleExport()}
              >
                Export CSV
              </button>
            </div>
          </div>

          {loading && !detail ? (
            <p className="text-sm text-neutral-600">Loading…</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500">Duration</p>
                  <p className="text-xl font-semibold">{formatDuration(active.durationSeconds)}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500">Attended</p>
                  <p className="text-xl font-semibold">{active.attendedCount}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500">Registered / Absent</p>
                  <p className="text-xl font-semibold">
                    {active.registeredCount} / {active.absentCount}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500">Attendance rate</p>
                  <p className="text-xl font-semibold">{formatRate(active.attendanceRate)}</p>
                </div>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">Scheduled</dt>
                  <dd>{formatDate(active.scheduledAt)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Started</dt>
                  <dd>{formatDate(active.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Ended</dt>
                  <dd>{formatDate(active.endedAt)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Avg attend time</dt>
                  <dd>{formatDuration(active.avgDurationSeconds)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Total rostered</dt>
                  <dd>{active.totalCount}</dd>
                </div>
              </dl>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
