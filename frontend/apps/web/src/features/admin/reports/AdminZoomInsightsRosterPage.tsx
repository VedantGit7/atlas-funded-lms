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
  ZOOM_PARTICIPANT_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportZoomInsightsReport,
  fetchZoomMeetingDetail,
  fetchZoomMeetingParticipants,
  fetchZoomMeetingsRoster,
  type ZoomMeetingDetail,
  type ZoomMeetingListItem,
  type ZoomParticipantColumnKey,
  type ZoomParticipantItem,
} from "./admin-zoom-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type DrillLevel = "meetings" | "detail";

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

export function AdminZoomInsightsRosterPage() {
  const [level, setLevel] = useState<DrillLevel>("meetings");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<ZoomMeetingListItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "unknown"
  >("unknown");
  const [selectedMeeting, setSelectedMeeting] = useState<ZoomMeetingListItem | null>(null);
  const [detail, setDetail] = useState<ZoomMeetingDetail | null>(null);
  const [participants, setParticipants] = useState<ZoomParticipantItem[]>([]);

  const [page, setPage] = useState(1);
  const [meetingsPage, setMeetingsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [meetingsTotalPages, setMeetingsTotalPages] = useState(0);

  const [searchQ, setSearchQ] = useState("");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [sortBy, setSortBy] = useState("join_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columns, setColumns] = useState<ZoomParticipantColumnKey[]>(
    ZOOM_PARTICIPANT_COLUMN_OPTIONS.map((column) => column.key),
  );

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomMeetingsRoster({
        q: searchQ.trim() || undefined,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        page: meetingsPage,
      });
      setMeetings(response.data.items);
      setConnectionStatus(response.data.connectionStatus);
      setMeetingsTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load Zoom meetings.",
      );
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [meetingsPage, searchQ, startedFrom, startedTo]);

  const loadDetail = useCallback(async () => {
    if (!selectedMeeting) return;
    setLoading(true);
    setError(null);
    try {
      const [detailResponse, participantsResponse] = await Promise.all([
        fetchZoomMeetingDetail(selectedMeeting.id),
        fetchZoomMeetingParticipants(selectedMeeting.id, {
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
          joinedFrom: dateInputToStartIso(joinedFrom),
          joinedTo: dateInputToEndIso(joinedTo),
          sortBy,
          sortDir,
          columns,
          page,
        }),
      ]);
      setDetail(detailResponse.data);
      setParticipants(participantsResponse.data.items);
      setTotalCount(participantsResponse.data.pageInfo.totalCount);
      setTotalPages(participantsResponse.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load Zoom meeting report.",
      );
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [columns, displayName, email, joinedFrom, joinedTo, page, selectedMeeting, sortBy, sortDir]);

  useEffect(() => {
    if (level === "meetings") {
      void loadMeetings();
      return;
    }
    void loadDetail();
  }, [level, loadDetail, loadMeetings]);

  function openMeeting(meeting: ZoomMeetingListItem) {
    setSelectedMeeting(meeting);
    setDetail(null);
    setParticipants([]);
    setPage(1);
    setDisplayName("");
    setEmail("");
    setJoinedFrom("");
    setJoinedTo("");
    setLevel("detail");
  }

  function goBack() {
    setSelectedMeeting(null);
    setDetail(null);
    setParticipants([]);
    setLevel("meetings");
  }

  async function handleExport() {
    if (!selectedMeeting) return;
    setBusy(true);
    setError(null);
    try {
      const response = await exportZoomInsightsReport({
        meetingId: selectedMeeting.id,
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
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

  function toggleColumn(key: ZoomParticipantColumnKey) {
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
        <h1 className={generalSettingsPageTitleClassName}>Zoom Insights</h1>
        <p className={generalSettingsPageDescClassName}>
          Review Zoom live classes with duration and attendance, then open participant join/leave
          details and export CSV.
        </p>
      </div>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      {level === "detail" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghostButtonClassName} onClick={goBack}>
            Back
          </button>
          <p className="text-sm text-neutral-600">
            {detail?.topic ?? selectedMeeting?.topic ?? "Untitled meeting"}
          </p>
        </div>
      ) : null}

      {level === "meetings" ? (
        <section className={generalSettingsFormCardClassName}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-600">
              Zoom connection: <span className="font-medium capitalize">{connectionStatus}</span>
            </p>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              Search meetings
              <input
                className={fieldClassName}
                value={searchQ}
                onChange={(event) => {
                  setSearchQ(event.target.value);
                }}
                placeholder="Topic or meeting ID"
              />
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
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                if (meetingsPage !== 1) {
                  setMeetingsPage(1);
                } else {
                  void loadMeetings();
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
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                        No Zoom meetings found. Connect Zoom and sync completed sessions to populate
                        this report.
                      </td>
                    </tr>
                  ) : (
                    meetings.map((meeting) => (
                      <tr
                        key={meeting.id}
                        className={`${analyticsTableRowClassName} cursor-pointer`}
                        onClick={() => {
                          openMeeting(meeting);
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{meeting.topic ?? "Untitled meeting"}</div>
                          <div className="text-xs text-neutral-500">
                            ID {meeting.externalMeetingId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">{formatDate(meeting.startedAt)}</td>
                        <td className="px-4 py-3">{formatDuration(meeting.durationSeconds)}</td>
                        <td className="px-4 py-3">{meeting.attendanceCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          {meetingsTotalPages > 1 ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={meetingsPage <= 1 || loading}
                onClick={() => {
                  setMeetingsPage((current) => Math.max(1, current - 1));
                }}
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">
                Page {meetingsPage} of {meetingsTotalPages}
              </span>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={meetingsPage >= meetingsTotalPages || loading}
                onClick={() => {
                  setMeetingsPage((current) => current + 1);
                }}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {level === "detail" && selectedMeeting ? (
        <>
          <section className={generalSettingsFormCardClassName}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Meeting insights</h2>
                <p className="text-sm text-neutral-600">
                  Started {formatDate(detail?.startedAt ?? selectedMeeting.startedAt)} · Ended{" "}
                  {formatDate(detail?.endedAt ?? selectedMeeting.endedAt)}
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
                  {formatDuration(detail?.durationSeconds ?? selectedMeeting.durationSeconds)}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Attendance</p>
                <p className="text-xl font-semibold">
                  {detail?.attendanceCount ?? selectedMeeting.attendanceCount}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Avg participant time</p>
                <p className="text-xl font-semibold">
                  {formatDuration(detail?.avgDurationSeconds)}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Total attend time</p>
                <p className="text-xl font-semibold">
                  {formatDuration(detail?.totalAttendanceSeconds)}
                </p>
              </div>
            </div>
          </section>

          <section className={generalSettingsFormCardClassName}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Participants</h2>
                <p className="text-sm text-neutral-600">
                  {totalCount} participant{totalCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                Name
                <input
                  className={fieldClassName}
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                  }}
                  placeholder="Display name"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Email
                <input
                  className={fieldClassName}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                  placeholder="Learner email"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Joined from
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedFrom}
                  onChange={(event) => {
                    setJoinedFrom(event.target.value);
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Joined to
                <input
                  type="date"
                  className={fieldClassName}
                  value={joinedTo}
                  onChange={(event) => {
                    setJoinedTo(event.target.value);
                  }}
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
                  <option value="join_time">Join time</option>
                  <option value="leave_time">Leave time</option>
                  <option value="display_name">Name</option>
                  <option value="email">Email</option>
                  <option value="duration_seconds">Duration</option>
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
              {ZOOM_PARTICIPANT_COLUMN_OPTIONS.map((column) => {
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
              {loading && participants.length === 0 ? (
                <p className="p-4 text-sm text-neutral-600">Loading…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className={analyticsTableHeadClassName}>
                    <tr>
                      {columns.includes("display_name") ? (
                        <th className="px-4 py-3">Name</th>
                      ) : null}
                      {columns.includes("email") ? <th className="px-4 py-3">Email</th> : null}
                      {columns.includes("join_time") ? (
                        <th className="px-4 py-3">Join time</th>
                      ) : null}
                      {columns.includes("leave_time") ? (
                        <th className="px-4 py-3">Leave time</th>
                      ) : null}
                      {columns.includes("duration_seconds") ? (
                        <th className="px-4 py-3">Duration</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {participants.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-6 text-neutral-500"
                          colSpan={Math.max(1, columns.length)}
                        >
                          No participants match these filters.
                        </td>
                      </tr>
                    ) : (
                      participants.map((participant) => (
                        <tr key={participant.id} className={analyticsTableRowClassName}>
                          {columns.includes("display_name") ? (
                            <td className="px-4 py-3 font-medium">
                              {participant.displayName ?? "—"}
                            </td>
                          ) : null}
                          {columns.includes("email") ? (
                            <td className="px-4 py-3">{participant.email ?? "—"}</td>
                          ) : null}
                          {columns.includes("join_time") ? (
                            <td className="px-4 py-3 text-xs">
                              {formatDate(participant.joinTime)}
                            </td>
                          ) : null}
                          {columns.includes("leave_time") ? (
                            <td className="px-4 py-3 text-xs">
                              {formatDate(participant.leaveTime)}
                            </td>
                          ) : null}
                          {columns.includes("duration_seconds") ? (
                            <td className="px-4 py-3">
                              {formatDuration(participant.durationSeconds)}
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
    </div>
  );
}
