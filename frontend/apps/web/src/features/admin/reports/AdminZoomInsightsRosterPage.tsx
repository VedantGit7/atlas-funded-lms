"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Filter,
  Link2,
  MoreVertical,
  RefreshCw,
  Search,
  Settings2,
  Video,
  VideoOff,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  connectZoomAccount,
  dateInputToEndIso,
  dateInputToStartIso,
  exportZoomInsightsReport,
  fetchZoomMeetingsRoster,
  type ZoomConnectionMeta,
  type ZoomMeetingListItem,
  type ZoomMeetingsSummary,
  type ZoomMeetingsView,
} from "./admin-zoom-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ModuleTab = "meetings" | "participants" | "unmatched" | "connection" | "exports";
type DatePreset = "7d" | "30d" | "90d" | "custom";

const PAGE_SIZE = 50;

const secondaryButtonClassName =
  "inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-8 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

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

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs)}s`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "never";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${String(mins)} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${String(hours)} hour${hours === 1 ? "" : "s"} ago`;
  return formatDateShort(value);
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);
  return { from: fromIso, to: toIso };
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted" | "primary";
  children: ReactNode;
}) {
  const tones = {
    success:
      "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]",
    danger:
      "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    primary:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function CoverageBar({ ratio }: { ratio: number }) {
  const width = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-150"
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}

function MeetingsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading Zoom insights">
      <div className="flex h-10 items-center gap-4 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4">
        <Shimmer className="h-5 w-5 rounded-full" />
        <Shimmer className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-3 h-3 w-24" />
            <Shimmer className="mb-2 h-8 w-16" />
            <Shimmer className="h-2 w-full" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-14 items-center gap-4 border-b border-[var(--admin-border)] px-4">
          <Shimmer className="h-8 w-32" />
          <Shimmer className="h-8 w-24" />
          <div className="flex-1" />
          <Shimmer className="h-8 w-48" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-4 px-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-4 w-48" />
              <Shimmer className="ml-auto h-4 w-24" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-12" />
              <Shimmer className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectionBanner({
  connection,
  onSync,
  onReconnect,
  onCheck,
  syncing,
}: {
  connection: ZoomConnectionMeta;
  onSync: () => void;
  onReconnect: () => void;
  onCheck: () => void;
  syncing: boolean;
}) {
  if (connection.status === "connected") {
    return (
      <div className="flex h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface)]">
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--admin-success)]" />
          <span className="font-semibold">Zoom connected</span>
          <span className="text-[var(--admin-on-surface-variant)]">·</span>
          <span className="text-[var(--admin-on-surface-variant)]">
            last synced {formatRelative(connection.lastSyncedAt)}
          </span>
          <span className="text-[var(--admin-on-surface-variant)]">·</span>
          <span>
            {formatCount(connection.meetingsImportedToday)} meeting
            {connection.meetingsImportedToday === 1 ? "" : "s"} imported today
          </span>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
    );
  }

  if (connection.status === "disconnected") {
    return (
      <div className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-danger)]" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-base font-semibold text-[var(--admin-danger)]">
                Zoom is not connected.
              </h3>
              <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--admin-danger)_80%,var(--admin-on-surface))]">
                The data below was last synced on{" "}
                <span className="font-mono font-medium">
                  {formatDateShort(connection.lastSyncedAt)}
                </span>{" "}
                and will not update.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`${primaryButtonClassName} h-10 shrink-0 px-6`}
            disabled={syncing}
            onClick={onReconnect}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Reconnect Zoom
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-3">
      <div className="flex items-start gap-3 sm:items-center">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)] sm:mt-0"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface)]">
          Could not verify the Zoom connection. Data may be incomplete.
        </p>
      </div>
      <button
        type="button"
        className={secondaryButtonClassName}
        disabled={syncing}
        onClick={onCheck}
      >
        Check connection
      </button>
    </div>
  );
}

export function AdminZoomInsightsRosterPage() {
  const router = useRouter();
  const searchId = useId();
  const [moduleTab, setModuleTab] = useState<ModuleTab>("meetings");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<ZoomMeetingListItem[]>([]);
  const [connection, setConnection] = useState<ZoomConnectionMeta | null>(null);
  const [summary, setSummary] = useState<ZoomMeetingsSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [meetingsPage, setMeetingsPage] = useState(1);
  const [meetingsTotalPages, setMeetingsTotalPages] = useState(0);
  const [meetingsTotalCount, setMeetingsTotalCount] = useState(0);

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const initialRange = useMemo(() => presetToRange("30d"), []);
  const [startedFrom, setStartedFrom] = useState(initialRange.from);
  const [startedTo, setStartedTo] = useState(initialRange.to);
  const [draftSearch, setDraftSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [view, setView] = useState<ZoomMeetingsView>("all");
  const [sortBy, setSortBy] = useState<"started_at" | "attendance_count" | "duration_seconds">(
    "started_at",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const neverConnected =
    connection != null &&
    !connection.hasConnectionRecord &&
    connection.status === "unknown" &&
    meetingsTotalCount === 0 &&
    !searchQ;

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomMeetingsRoster({
        q: searchQ.trim() || undefined,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        view,
        sortBy,
        sortDir,
        page: meetingsPage,
        limit: PAGE_SIZE,
      });
      setMeetings(response.data.items);
      setConnection(response.data.connection);
      setSummary(response.data.summary);
      setMeetingsTotalPages(response.data.pageInfo.totalPages);
      setMeetingsTotalCount(response.data.pageInfo.totalCount);
      setSelectedIds((current) =>
        current.filter((id) => response.data.items.some((item) => item.id === id)),
      );
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load Zoom meetings.",
      );
      setMeetings([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [meetingsPage, searchQ, sortBy, sortDir, startedFrom, startedTo, view]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  function applyDatePreset(preset: DatePreset) {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setStartedFrom(range.from);
    setStartedTo(range.to);
    setMeetingsPage(1);
  }

  function openMeeting(meeting: ZoomMeetingListItem) {
    setRowMenuId(null);
    router.push(`/admin/reports/zoom-insights/${meeting.id}`);
  }

  async function handleExportMeetings() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportZoomInsightsReport({
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

  async function handleReconnect() {
    setBusy(true);
    setError(null);
    try {
      await connectZoomAccount({});
      await loadMeetings();
    } catch (connectError) {
      setError(
        connectError instanceof ClientApiError
          ? connectError.message
          : connectError instanceof Error
            ? connectError.message
            : "Unable to connect Zoom.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyMeetingId(externalId: string) {
    try {
      await navigator.clipboard.writeText(externalId);
      setCopiedId(externalId);
      window.setTimeout(() => {
        setCopiedId((current) => (current === externalId ? null : current));
      }, 1500);
    } catch {
      setError("Couldn't copy meeting ID.");
    }
  }

  function toggleSelectAll() {
    if (selectedIds.length === meetings.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(meetings.map((meeting) => meeting.id));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleSort(column: "started_at" | "attendance_count" | "duration_seconds") {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setMeetingsPage(1);
  }

  const rangeStart = meetingsTotalCount === 0 ? 0 : (meetingsPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(meetingsPage * PAGE_SIZE, meetingsTotalCount);
  const selectedParticipantCount = useMemo(
    () =>
      meetings
        .filter((meeting) => selectedIds.includes(meeting.id))
        .reduce((sum, meeting) => sum + meeting.attendanceCount, 0),
    [meetings, selectedIds],
  );

  const showStaleChrome = connection?.status === "disconnected";

  if (neverConnected && !loading && !error) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <Breadcrumb />
        <PageHeader
          datePreset={datePreset}
          onDatePreset={applyDatePreset}
          onExport={() => void handleExportMeetings()}
          onSync={() => void loadMeetings()}
          onSettings={() => {
            router.push("/admin/reports/zoom-insights/connection");
          }}
          busy={busy}
          disabledActions
        />
        <ModuleTabs
          active={moduleTab}
          onChange={(tab) => {
            if (tab === "participants") {
              router.push("/admin/reports/zoom-insights/participants");
              return;
            }
            if (tab === "unmatched") {
              router.push("/admin/reports/zoom-insights/unmatched");
              return;
            }
            if (tab === "connection") {
              router.push("/admin/reports/zoom-insights/connection");
              return;
            }
            if (tab === "exports") {
              router.push("/admin/reports/zoom-insights/exports");
              return;
            }
            setModuleTab(tab);
          }}
        />
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="flex w-full max-w-md flex-col items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <VideoOff
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <h2 className="mb-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              Zoom is not connected
            </h2>
            <p className="mb-8 max-w-[280px] text-sm text-[var(--admin-on-surface-variant)]">
              Connect a Zoom account to import meeting and participant data.
            </p>
            <button
              type="button"
              className={`${primaryButtonClassName} h-11 px-6`}
              disabled={busy}
              onClick={() => void handleReconnect()}
            >
              Connect Zoom
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <>
        <Breadcrumb />
        <PageHeader
          datePreset={datePreset}
          onDatePreset={applyDatePreset}
          onExport={() => void handleExportMeetings()}
          onSync={() => void loadMeetings()}
          onSettings={() => {
            router.push("/admin/reports/zoom-insights/connection");
          }}
          busy={busy || loading}
          disabledActions={connection?.status === "disconnected"}
        />

        <ModuleTabs
          active={moduleTab}
          onChange={(tab) => {
            if (tab === "unmatched") {
              router.push("/admin/reports/zoom-insights/unmatched");
              return;
            }
            if (tab === "participants") {
              router.push("/admin/reports/zoom-insights/participants");
              return;
            }
            if (tab === "connection") {
              router.push("/admin/reports/zoom-insights/connection");
              return;
            }
            if (tab === "exports") {
              router.push("/admin/reports/zoom-insights/exports");
              return;
            }
            setModuleTab(tab);
          }}
        />

        {connection && !loading ? (
          <ConnectionBanner
            connection={connection}
            syncing={busy || loading}
            onSync={() => void loadMeetings()}
            onReconnect={() => void handleReconnect()}
            onCheck={() => {
              router.push("/admin/reports/zoom-insights/connection");
            }}
          />
        ) : null}

        <>
          {error ? (
            <div className="relative overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--admin-danger)]">
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                  Couldn&apos;t load Zoom meetings. {error}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--admin-danger)] px-4 py-1.5 text-sm text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
                  onClick={() => void loadMeetings()}
                >
                  Retry
                </button>
              </div>
              <div className="pointer-events-none p-6 pt-16 opacity-40">
                <MeetingsLoadingSkeleton />
              </div>
            </div>
          ) : null}

          {!error && loading ? <MeetingsLoadingSkeleton /> : null}

          {!error && !loading ? (
            <>
              {summary ? (
                <div
                  className={[
                    "grid grid-cols-2 gap-3 lg:grid-cols-5",
                    showStaleChrome ? "opacity-80" : "",
                  ].join(" ")}
                >
                  <SummaryCell
                    label="Meetings"
                    value={formatCount(summary.meetingCount)}
                    caption={
                      datePreset === "30d"
                        ? "in the last 30 days"
                        : datePreset === "7d"
                          ? "in the last 7 days"
                          : datePreset === "90d"
                            ? "in the last 90 days"
                            : "in selected range"
                    }
                    wide
                  />
                  <SummaryCell
                    label="Participants"
                    value={formatCount(summary.participantCount)}
                    caption={`${formatCount(summary.matchedCount)} matched · ${formatCount(summary.unmatchedCount)} unmatched`}
                  />
                  <SummaryCell
                    label="Total attendance"
                    value={formatDuration(summary.totalAttendanceSeconds)}
                  />
                  <SummaryCell
                    label="Avg per meeting"
                    value={
                      summary.avgAttendancePerMeeting == null
                        ? "—"
                        : summary.avgAttendancePerMeeting.toFixed(1)
                    }
                  />
                  <SummaryCell
                    label="Avg duration"
                    value={formatDuration(summary.avgDurationSeconds)}
                  />
                </div>
              ) : null}
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Reported by Zoom. Durations come from Zoom&apos;s participant records and may differ
                from LMS session attendance.
              </p>

              {showStaleChrome ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--admin-on-surface)]">
                      Platform Analytics
                    </h2>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Stale data view (Read-only)
                    </p>
                  </div>
                  <StatusPill tone="muted">Stale data</StatusPill>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "All meetings"],
                      ["has_unmatched", "Has unmatched"],
                      ["no_participants", "No participants"],
                    ] as const
                  ).map(([value, label]) => {
                    const active = view === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={[
                          "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
                          active
                            ? "border border-[var(--admin-primary)] bg-[var(--admin-primary-container)] text-[var(--admin-primary)]"
                            : "border border-transparent bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-variant)]",
                        ].join(" ")}
                        onClick={() => {
                          setView(value);
                          setMeetingsPage(1);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      id={searchId}
                      className={`${fieldClassName} w-48 pl-8`}
                      placeholder="Filter meetings…"
                      value={draftSearch}
                      onChange={(event) => {
                        setDraftSearch(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setSearchQ(draftSearch.trim());
                          setMeetingsPage(1);
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    aria-expanded={filtersOpen}
                    onClick={() => {
                      setFiltersOpen((current) => !current);
                    }}
                  >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    Filters
                  </button>
                </div>
              </div>

              {filtersOpen ? (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Started from
                    <input
                      type="date"
                      className={fieldClassName}
                      value={startedFrom}
                      onChange={(event) => {
                        setDatePreset("custom");
                        setStartedFrom(event.target.value);
                        setMeetingsPage(1);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Started to
                    <input
                      type="date"
                      className={fieldClassName}
                      value={startedTo}
                      onChange={(event) => {
                        setDatePreset("custom");
                        setStartedTo(event.target.value);
                        setMeetingsPage(1);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    onClick={() => {
                      setSearchQ(draftSearch.trim());
                      setMeetingsPage(1);
                      void loadMeetings();
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    onClick={() => {
                      setDraftSearch("");
                      setSearchQ("");
                      setView("all");
                      applyDatePreset("30d");
                      setFiltersOpen(false);
                    }}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}

              {meetings.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
                  <Video
                    className="mb-6 h-14 w-14 text-[var(--admin-outline)]"
                    strokeWidth={1.25}
                    aria-hidden="true"
                  />
                  <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                    No Zoom meetings in this range
                  </h3>
                  <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                    Only completed meetings are imported. Try widening the date range or syncing
                    now.
                  </p>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={busy || connection?.status === "disconnected"}
                    onClick={() => void loadMeetings()}
                  >
                    Sync now
                  </button>
                </div>
              ) : (
                <div
                  className={[
                    "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm",
                    showStaleChrome ? "opacity-80" : "",
                  ].join(" ")}
                >
                  {selectedIds.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-2 text-sm">
                      <p className="text-[var(--admin-on-surface)]">
                        <span className="font-mono font-medium">
                          {formatCount(selectedIds.length)}
                        </span>{" "}
                        meetings selected ·{" "}
                        <span className="font-mono font-medium">
                          {formatCount(selectedParticipantCount)}
                        </span>{" "}
                        participants
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={busy}
                          onClick={() => void handleExportMeetings()}
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

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left whitespace-nowrap">
                      <thead className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        <tr>
                          <th className="w-10 px-4 py-3">
                            <input
                              type="checkbox"
                              className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                              checked={
                                meetings.length > 0 && selectedIds.length === meetings.length
                              }
                              onChange={toggleSelectAll}
                              aria-label="Select all meetings"
                            />
                          </th>
                          <th className="px-4 py-3">Topic / ID</th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-[var(--admin-on-surface)]"
                              onClick={() => {
                                toggleSort("started_at");
                              }}
                            >
                              Started
                              {sortBy === "started_at" ? (
                                <ArrowDown
                                  className={[
                                    "h-4 w-4 text-[var(--admin-primary)]",
                                    sortDir === "asc" ? "rotate-180" : "",
                                  ].join(" ")}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-[var(--admin-on-surface)]"
                              onClick={() => {
                                toggleSort("duration_seconds");
                              }}
                            >
                              Duration
                              {sortBy === "duration_seconds" ? (
                                <ArrowDown
                                  className={[
                                    "h-4 w-4 text-[var(--admin-primary)]",
                                    sortDir === "asc" ? "rotate-180" : "",
                                  ].join(" ")}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </button>
                          </th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-[var(--admin-on-surface)]"
                              onClick={() => {
                                toggleSort("attendance_count");
                              }}
                            >
                              Participants
                              {sortBy === "attendance_count" ? (
                                <ArrowDown
                                  className={[
                                    "h-4 w-4 text-[var(--admin-primary)]",
                                    sortDir === "asc" ? "rotate-180" : "",
                                  ].join(" ")}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right">Attendance</th>
                          <th className="px-4 py-3">Linked session</th>
                          <th className="w-10 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--admin-border)]">
                        {meetings.map((meeting) => {
                          const unmatched = meeting.unmatchedCount > 0;
                          const empty = meeting.attendanceCount === 0;
                          const untitled = !meeting.topic;
                          return (
                            <tr
                              key={meeting.id}
                              className={[
                                "group h-11 transition-colors hover:bg-[var(--admin-surface-high)]",
                                unmatched ? "border-l-2 border-l-[var(--admin-warning)]" : "",
                                empty ? "opacity-75" : "",
                              ].join(" ")}
                            >
                              <td className="px-4">
                                <input
                                  type="checkbox"
                                  className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                  checked={selectedIds.includes(meeting.id)}
                                  disabled={empty}
                                  onChange={() => {
                                    toggleSelect(meeting.id);
                                  }}
                                  aria-label={`Select ${meeting.topic ?? "untitled meeting"}`}
                                />
                              </td>
                              <td className="px-4">
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    className={[
                                      "text-left text-[13px] font-semibold hover:underline",
                                      untitled
                                        ? "italic text-[var(--admin-on-surface-variant)]"
                                        : "text-[var(--admin-primary)]",
                                    ].join(" ")}
                                    onClick={() => {
                                      openMeeting(meeting);
                                    }}
                                  >
                                    {meeting.topic ?? "Untitled meeting"}
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                                    onClick={() => void copyMeetingId(meeting.externalMeetingId)}
                                  >
                                    {meeting.externalMeetingId}
                                    {copiedId === meeting.externalMeetingId ? (
                                      <Check className="h-3 w-3" aria-hidden="true" />
                                    ) : (
                                      <Copy
                                        className="h-3 w-3 opacity-0 group-hover:opacity-100"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {formatDateTime(meeting.startedAt)}
                              </td>
                              <td className="px-4 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {formatDuration(meeting.durationSeconds)}
                              </td>
                              <td className="px-4">
                                {empty ? (
                                  <span className="text-xs italic text-[var(--admin-on-surface-variant)]">
                                    No participants recorded
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[13px]">
                                      {formatCount(meeting.attendanceCount)}
                                    </span>
                                    {unmatched ? (
                                      <StatusPill tone="warning">
                                        {formatCount(meeting.unmatchedCount)} unmatched
                                      </StatusPill>
                                    ) : (
                                      <CoverageBar ratio={1} />
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                                {empty ? "—" : formatDuration(meeting.totalAttendanceSeconds)}
                              </td>
                              <td className="px-4 text-[13px] italic text-[var(--admin-on-surface-variant)]">
                                Unlinked
                              </td>
                              <td className="relative px-4">
                                <button
                                  type="button"
                                  className="rounded p-1 text-[var(--admin-on-surface-variant)] opacity-0 hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] group-hover:opacity-100"
                                  aria-label="Row actions"
                                  onClick={() => {
                                    setRowMenuId((current) =>
                                      current === meeting.id ? null : meeting.id,
                                    );
                                  }}
                                >
                                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                </button>
                                {rowMenuId === meeting.id ? (
                                  <div className="absolute right-2 z-20 mt-1 min-w-[180px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--admin-surface-high)]"
                                      onClick={() => {
                                        openMeeting(meeting);
                                      }}
                                    >
                                      Open meeting
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--admin-surface-high)]"
                                      onClick={() => {
                                        openMeeting(meeting);
                                      }}
                                    >
                                      View participants
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--admin-surface-high)]"
                                      onClick={() => {
                                        void copyMeetingId(meeting.externalMeetingId);
                                        setRowMenuId(null);
                                      }}
                                    >
                                      Copy Zoom meeting ID
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex h-10 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-xs text-[var(--admin-on-surface-variant)]">
                    <span>
                      Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{" "}
                      {formatCount(meetingsTotalCount)} meetings
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                        disabled={meetingsPage <= 1 || loading}
                        onClick={() => {
                          setMeetingsPage((current) => Math.max(1, current - 1));
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                        disabled={
                          meetingsTotalPages === 0 || meetingsPage >= meetingsTotalPages || loading
                        }
                        onClick={() => {
                          setMeetingsPage((current) => current + 1);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      </>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav
      className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
      aria-label="Breadcrumb"
    >
      <Link href="/admin" className="hover:text-[var(--admin-primary)]">
        Admin
      </Link>
      <span>/</span>
      <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
        Reports
      </Link>
      <span>/</span>
      <span className="font-medium text-[var(--admin-primary)]">Zoom Insights</span>
    </nav>
  );
}

function PageHeader({
  datePreset,
  onDatePreset,
  onExport,
  onSync,
  onSettings,
  busy,
  disabledActions,
}: {
  datePreset: DatePreset;
  onDatePreset: (preset: DatePreset) => void;
  onExport: () => void;
  onSync: () => void;
  onSettings: () => void;
  busy: boolean;
  disabledActions?: boolean;
}) {
  const presetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "90d"
        ? "Last 90 days"
        : datePreset === "custom"
          ? "Custom range"
          : "Last 30 days";

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-8 tracking-[-0.01em] text-[var(--admin-on-surface)]">
          Zoom Insights
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          Meetings and participant attendance imported from your connected Zoom account.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            className={`${secondaryButtonClassName} appearance-none pr-8`}
            value={datePreset}
            aria-label="Date range"
            onChange={(event) => {
              const value = event.target.value;
              if (value === "7d" || value === "30d" || value === "90d" || value === "custom") {
                onDatePreset(value);
              }
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
          <Calendar
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <span className="sr-only">{presetLabel}</span>
        </div>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy || disabledActions}
          onClick={onExport}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy || disabledActions}
          onClick={onSync}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Sync now
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-outline)] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] active:translate-y-px"
          aria-label="Connection settings"
          onClick={onSettings}
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ModuleTabs({
  active,
  onChange,
}: {
  active: ModuleTab;
  onChange: (tab: ModuleTab) => void;
}) {
  const tabs: Array<[ModuleTab, string]> = [
    ["meetings", "Meetings"],
    ["participants", "Participants"],
    ["unmatched", "Unmatched"],
    ["connection", "Connection"],
    ["exports", "Exports"],
  ];
  return (
    <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
      {tabs.map(([value, label]) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[
              "px-1 pb-2 text-base font-semibold transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              onChange(value);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  caption,
  wide,
}: {
  label: string;
  value: string;
  caption?: string | undefined;
  wide?: boolean | undefined;
}) {
  return (
    <div
      className={[
        "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4",
        wide ? "lg:col-span-2" : "",
      ].join(" ")}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-[28px] font-semibold leading-none tracking-tight text-[var(--admin-on-surface)]">
        {value}
      </p>
      {caption ? (
        <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
      ) : null}
    </div>
  );
}
