"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  Filter,
  GraduationCap,
  Link2,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  DEFAULT_ZOOM_PARTICIPANT_COLUMNS,
  ZOOM_PARTICIPANT_COLUMN_OPTIONS,
  connectZoomAccount,
  dateInputToEndIso,
  dateInputToStartIso,
  exportZoomInsightsReport,
  fetchZoomMeetingDetail,
  fetchZoomMeetingParticipants,
  type ZoomConnectionMeta,
  type ZoomMeetingDetail,
  type ZoomMatchState,
  type ZoomParticipantColumnKey,
  type ZoomParticipantItem,
  type ZoomTimelinePoint,
} from "./admin-zoom-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const PAGE_SIZE = 25;

const secondaryButtonClassName =
  "inline-flex h-8 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

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

function formatDurationParts(seconds: number | null | undefined): ReactNode {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return (
      <>
        {hours}
        <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">h</span>{" "}
        {String(minutes).padStart(2, "0")}
        <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">m</span>
      </>
    );
  }
  return (
    <>
      {minutes}
      <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">m</span>{" "}
      {String(secs).padStart(2, "0")}
      <span className="ml-0.5 text-base text-[var(--admin-on-surface-variant)]">s</span>
    </>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatRelative(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "never";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${String(hours)}h ago`;
  return formatDateTime(value);
}

function formatCount(value: number): string {
  return value.toLocaleString();
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
      "border-[color-mix(in_srgb,var(--admin-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]",
    warning:
      "border-[color-mix(in_srgb,var(--admin-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]",
    danger:
      "border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] text-[var(--admin-danger)]",
    muted:
      "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    primary:
      "border-[color-mix(in_srgb,var(--admin-primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function CoverageBar({
  ratio,
  tone = "primary",
  fractured,
}: {
  ratio: number;
  tone?: "primary" | "success" | "warning" | "muted";
  fractured?: boolean;
}) {
  const colors = {
    primary: "bg-[var(--admin-primary)]/80",
    success: "bg-[var(--admin-success)]/70",
    warning: "bg-[var(--admin-warning)]/60",
    muted: "bg-[var(--admin-on-surface-variant)]/40",
  };
  const width = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  if (fractured) {
    return (
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div className={`absolute inset-y-0 left-0 w-[30%] ${colors[tone]}`} />
        <div className={`absolute inset-y-0 left-[40%] w-[15%] ${colors[tone]}`} />
        <div className={`absolute inset-y-0 left-[60%] w-[20%] ${colors[tone]}`} />
      </div>
    );
  }
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${colors[tone]}`}
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}

function AttendanceTimelineChart({
  timeline,
  peakAt,
  peakConcurrent,
}: {
  timeline: ZoomTimelinePoint[];
  peakAt: string | null;
  peakConcurrent: number;
}) {
  const chart = useMemo(() => {
    if (timeline.length === 0) return null;
    const max = Math.max(peakConcurrent, ...timeline.map((point) => point.concurrent), 1);
    const width = 1000;
    const height = 200;
    const points = timeline.map((point, index) => {
      const x =
        timeline.length === 1 ? width / 2 : (index / Math.max(timeline.length - 1, 1)) * width;
      const y = height - (point.concurrent / max) * (height - 24) - 8;
      return { x, y, point };
    });
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${String(p.x)},${String(p.y)}`)
      .join(" ");
    const area = `${line} L${String(width)},${String(height)} L0,${String(height)} Z`;
    const firstPoint = points[0];
    if (!firstPoint) return null;
    const peakPoint =
      peakAt != null
        ? (points.find((p) => p.point.at === peakAt) ??
          points.reduce(
            (best, p) => (p.point.concurrent > best.point.concurrent ? p : best),
            firstPoint,
          ))
        : points.reduce(
            (best, p) => (p.point.concurrent > best.point.concurrent ? p : best),
            firstPoint,
          );
    const labels = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const index = Math.min(timeline.length - 1, Math.round(t * (timeline.length - 1)));
      return formatTime(timeline[index]?.at ?? null);
    });
    return { line, area, peakPoint, labels, width, height };
  }, [peakAt, peakConcurrent, timeline]);

  if (!chart) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
        Timeline unavailable for this meeting.
      </div>
    );
  }

  return (
    <div className="relative min-h-[200px] flex-1 p-4">
      <svg
        className="absolute inset-0 h-full w-full p-4 pb-8"
        viewBox={`0 0 ${String(chart.width)} ${String(chart.height)}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Attendance timeline, peak ${formatCount(peakConcurrent)} users`}
      >
        <defs>
          <linearGradient id="zoom-timeline-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,50 L1000,50 M0,100 L1000,100 M0,150 L1000,150"
          fill="none"
          stroke="var(--admin-surface-high)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <path d={chart.area} fill="url(#zoom-timeline-grad)" />
        <path
          d={chart.line}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={chart.peakPoint.x}
          x2={chart.peakPoint.x}
          y1={chart.peakPoint.y}
          y2={chart.height}
          stroke="var(--admin-primary)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
        <circle
          cx={chart.peakPoint.x}
          cy={chart.peakPoint.y}
          r="4"
          fill="var(--admin-surface)"
          stroke="var(--admin-primary)"
          strokeWidth="2"
        />
      </svg>
      <div className="absolute bottom-2 left-4 right-4 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {chart.labels.map((label, index) => (
          <span key={`${label}-${String(index)}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading meeting details">
      <div className="flex justify-between gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="flex flex-col gap-3">
          <Shimmer className="h-8 w-64" />
          <div className="flex gap-4">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-2 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-10">
        <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7">
          <div className="flex h-11 items-center border-b border-[var(--admin-border)] px-4">
            <Shimmer className="h-4 w-36" />
          </div>
          <div className="space-y-4 p-6">
            <Shimmer className="h-40 w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <Shimmer className="mb-3 h-4 w-28" />
            <Shimmer className="mb-2 h-8 w-full" />
            <div className="flex gap-2">
              <Shimmer className="h-6 w-16 rounded-full" />
              <Shimmer className="h-6 w-20 rounded-full" />
            </div>
          </div>
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex h-11 items-center gap-3 border-b border-[var(--admin-border)] px-4 last:border-b-0"
              >
                <Shimmer className="h-6 w-6 rounded-full" />
                <Shimmer className="h-3 w-1/2" />
                <Shimmer className="ml-auto h-3 w-8" />
              </div>
            ))}
          </div>
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
      <div className="flex h-10 flex-wrap items-center justify-between gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
          <span>
            Zoom Telemetry Status: <strong className="font-medium">Connected &amp; Syncing</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            Last ping: {formatRelative(connection.lastSyncedAt)}
          </span>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
            disabled={syncing}
            onClick={onSync}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>
    );
  }

  if (connection.status === "disconnected") {
    return (
      <div className="relative overflow-hidden rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4">
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-danger)]" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface)]">
              Zoom is disconnected. This meeting report will not refresh until you reconnect.
            </p>
          </div>
          <button
            type="button"
            className={`${primaryButtonClassName} h-9 shrink-0 px-4`}
            disabled={syncing}
            onClick={onReconnect}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
        Could not verify the Zoom connection. Data may be incomplete.
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

export function AdminZoomInsightsMeetingDetailPage({ meetingId }: { meetingId: string }) {
  const searchId = useId();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantError, setParticipantError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ZoomMeetingDetail | null>(null);
  const [participants, setParticipants] = useState<ZoomParticipantItem[]>([]);
  const [participantSummary, setParticipantSummary] = useState<{
    matchedCount: number;
    unmatchedCount: number;
    guestCount: number;
  } | null>(null);
  const [meetingDurationSeconds, setMeetingDurationSeconds] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [draftSearch, setDraftSearch] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [matchState, setMatchState] = useState<"all" | ZoomMatchState>("all");
  const [durationBucket, setDurationBucket] = useState<"any" | "under_10" | "10_to_30" | "over_30">(
    "any",
  );
  const [rejoinedOnly, setRejoinedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ZoomParticipantColumnKey[]>([
    ...DEFAULT_ZOOM_PARTICIPANT_COLUMNS,
  ]);
  const [draftColumns, setDraftColumns] = useState<ZoomParticipantColumnKey[]>([
    ...DEFAULT_ZOOM_PARTICIPANT_COLUMNS,
  ]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchZoomMeetingDetail(meetingId);
      setDetail(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load meeting details.",
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const loadParticipants = useCallback(async () => {
    setParticipantError(null);
    try {
      const response = await fetchZoomMeetingParticipants(meetingId, {
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        joinedFrom: dateInputToStartIso(joinedFrom),
        joinedTo: dateInputToEndIso(joinedTo),
        matchState,
        durationBucket,
        rejoinedOnly,
        columns,
        page,
        limit: PAGE_SIZE,
      });
      setParticipants(response.data.items);
      setParticipantSummary(response.data.summary);
      setMeetingDurationSeconds(response.data.meetingDurationSeconds);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setSelectedIds((current) =>
        current.filter((id) => response.data.items.some((item) => item.id === id)),
      );
    } catch (loadError) {
      setParticipantError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load participant data for this meeting.",
      );
      setParticipants([]);
    }
  }, [
    columns,
    displayName,
    durationBucket,
    email,
    joinedFrom,
    joinedTo,
    matchState,
    meetingId,
    page,
    rejoinedOnly,
  ]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    void loadParticipants();
  }, [detail, loadParticipants]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportZoomInsightsReport({
        meetingId,
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

  async function handleReconnect() {
    setBusy(true);
    try {
      await connectZoomAccount({});
      await loadDetail();
      await loadParticipants();
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

  function applySearch() {
    setDisplayName(draftSearch);
    setPage(1);
  }

  function filterUnmatched() {
    setMatchState("unmatched");
    setPage(1);
    setFiltersOpen(true);
  }

  function toggleSelectAll() {
    if (selectedIds.length === participants.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(participants.map((p) => p.id));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const coverageRatio =
    detail?.durationSeconds && detail.avgDurationSeconds != null && detail.durationSeconds > 0
      ? detail.avgDurationSeconds / detail.durationSeconds
      : null;

  const discrepancy =
    detail != null
      ? detail.attendanceCount - (detail.linkedSession?.lmsAttendanceCount ?? detail.matchedCount)
      : 0;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const isEmptyMeeting = detail != null && detail.attendanceCount === 0 && !participantError;
  const showStale = detail?.connection.status === "disconnected";

  if (loading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <nav
          className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
          aria-label="Breadcrumb"
        >
          <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <span>/</span>
          <Link href="/admin/reports/zoom-insights" className="hover:text-[var(--admin-primary)]">
            Zoom Insights
          </Link>
          <span>/</span>
          <span className="font-medium text-[var(--admin-on-surface)]">Meeting Details</span>
        </nav>
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <Link
          href="/admin/reports/zoom-insights"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All meetings
        </Link>
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-8 text-center">
          <AlertTriangle className="mb-4 h-8 w-8 text-[var(--admin-danger)]" aria-hidden="true" />
          <h1 className="mb-2 text-lg font-semibold text-[var(--admin-on-surface)]">
            Couldn&apos;t load this meeting
          </h1>
          <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => void loadDetail()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
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
        <Link href="/admin/reports/zoom-insights" className="hover:text-[var(--admin-primary)]">
          Zoom Insights
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--admin-on-surface)]">
          {detail.topic ?? "Untitled meeting"}
        </span>
      </nav>

      <ConnectionBanner
        connection={detail.connection}
        syncing={busy || loading}
        onSync={() => {
          void loadDetail();
          void loadParticipants();
        }}
        onReconnect={() => void handleReconnect()}
        onCheck={() => void loadDetail()}
      />

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <Link
              href="/admin/reports/zoom-insights"
              className="mb-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All meetings
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {detail.topic ?? "Untitled meeting"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-[var(--admin-primary)]"
                onClick={() => void copyMeetingId(detail.externalMeetingId)}
              >
                ID: {detail.externalMeetingId}
                {copiedId === detail.externalMeetingId ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
              <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" />
              {detail.linkedSession ? (
                <Link
                  href={`/admin/reports/live-class-attendance`}
                  className="inline-flex items-center gap-1 hover:text-[var(--admin-primary)]"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {detail.linkedSession.title}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 italic">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Not linked to an LMS session
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || isEmptyMeeting}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Report (.csv)
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-variant)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" />
            {detail.endedAt ? "Completed" : "In progress"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2.5 py-1 text-xs text-[var(--admin-on-surface-variant)]">
            {formatDuration(detail.durationSeconds)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2.5 py-1 text-xs text-[var(--admin-on-surface-variant)]">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCount(detail.attendanceCount)} Participants
          </span>
        </div>
      </div>

      {isEmptyMeeting ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard label="Participants" value="0" />
            <SummaryCard label="Duration" value="—" />
            <SummaryCard label="Started" value={formatDateTime(detail.startedAt)} />
            <SummaryCard label="Ended" value={formatDateTime(detail.endedAt)} />
          </div>
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <VideoOff className="h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" />
            </div>
            <h3 className="mb-2 max-w-md text-base font-semibold text-[var(--admin-on-surface)]">
              No participants were recorded for this meeting.
            </h3>
            <p className="mb-8 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Zoom sometimes omits participant reports for very short meetings or meetings where
              only the host joined.
            </p>
            <button
              type="button"
              className={`${primaryButtonClassName} h-10 gap-2 px-4`}
              disabled={busy}
              onClick={() => {
                void loadDetail();
                void loadParticipants();
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Sync now
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Summary band */}
          <div
            className={[
              "grid grid-cols-2 gap-4 lg:grid-cols-4",
              showStale ? "opacity-80" : "",
            ].join(" ")}
          >
            <div className="relative overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-bl-full bg-[var(--admin-surface-high)]/60" />
              <p className="text-xs text-[var(--admin-on-surface-variant)]">Participants</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[var(--admin-on-surface)]">
                {formatCount(detail.attendanceCount)}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-[var(--admin-success)]" />
                  {formatCount(participantSummary?.matchedCount ?? detail.matchedCount)} Matched
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-[var(--admin-warning)]" />
                  {formatCount(participantSummary?.unmatchedCount ?? detail.unmatchedCount)}{" "}
                  Unmatched
                </span>
              </div>
            </div>
            <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Total Attendance Volume
              </p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[var(--admin-on-surface)]">
                {formatDurationParts(detail.totalAttendanceSeconds)}
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                Cumulative time across all users
              </p>
            </div>
            <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <p className="text-xs text-[var(--admin-on-surface-variant)]">Average Duration</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[var(--admin-on-surface)]">
                {formatDurationParts(detail.avgDurationSeconds)}
              </p>
              {coverageRatio != null ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                    <div
                      className="h-full bg-[var(--admin-primary)]"
                      style={{ width: `${String(Math.round(coverageRatio * 1000) / 10)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {(coverageRatio * 100).toFixed(1)}% coverage vs session length
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col justify-between rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">Started</p>
                <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {formatDateTime(detail.startedAt)}
                </p>
              </div>
              <div className="mt-3">
                <p className="text-xs text-[var(--admin-on-surface-variant)]">Ended</p>
                <p className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {formatTime(detail.endedAt)}{" "}
                  <span className="text-[var(--admin-on-surface-variant)]">
                    ({formatDuration(detail.durationSeconds)})
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Timeline + Cross-check */}
          <div className={["grid gap-6 lg:grid-cols-10", showStale ? "opacity-80" : ""].join(" ")}>
            <div className="flex min-h-[260px] flex-col rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7">
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Attendance Timeline
                </h2>
                {detail.peakConcurrent > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    <TrendingUp
                      className="h-3.5 w-3.5 text-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                    Peak: {formatCount(detail.peakConcurrent)} users
                    {detail.peakAt ? ` @ ${formatTime(detail.peakAt)}` : ""}
                  </span>
                ) : null}
              </div>
              <AttendanceTimelineChart
                timeline={detail.timeline}
                peakAt={detail.peakAt}
                peakConcurrent={detail.peakConcurrent}
              />
            </div>

            <div className="flex flex-col rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-3">
              <div className="border-b border-[var(--admin-border)] px-4 py-3">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Data Cross-Check
                </h2>
              </div>
              <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-end justify-between border-b border-[var(--admin-border)] pb-4">
                  <div>
                    <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Zoom Telemetry
                    </p>
                    <p className="font-mono text-xl text-[var(--admin-on-surface)]">
                      {formatCount(detail.attendanceCount)}
                    </p>
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      Unique participants
                    </p>
                  </div>
                  <Video
                    className="h-8 w-8 text-[var(--admin-on-surface-variant)] opacity-30"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-end justify-between border-b border-[var(--admin-border)] pb-4">
                  <div>
                    <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                      LMS Registration
                    </p>
                    <p className="font-mono text-xl text-[var(--admin-on-surface)]">
                      {formatCount(detail.linkedSession?.lmsAttendanceCount ?? detail.matchedCount)}
                    </p>
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      {detail.linkedSession ? "Linked session count" : "Matched learners"}
                    </p>
                  </div>
                  <GraduationCap
                    className="h-8 w-8 text-[var(--admin-on-surface-variant)] opacity-30"
                    aria-hidden="true"
                  />
                </div>
                {discrepancy !== 0 ? (
                  <div className="mt-auto flex flex-col gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] p-3">
                    <div className="flex items-center gap-2 text-[var(--admin-warning)]">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <span className="text-[13px] font-semibold uppercase tracking-wide">
                        Discrepancy
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--admin-on-surface)]">
                      Zoom reports{" "}
                      <strong className="font-mono">{formatCount(Math.abs(discrepancy))}</strong>{" "}
                      {discrepancy > 0 ? "more" : "fewer"} users than LMS expects. Review unmatched
                      guests.
                    </p>
                    <button
                      type="button"
                      className="self-start text-xs font-medium text-[var(--admin-primary)] hover:underline"
                      onClick={filterUnmatched}
                    >
                      Filter Unmatched
                    </button>
                  </div>
                ) : (
                  <div className="mt-auto rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-[13px] text-[var(--admin-on-surface-variant)]">
                    Zoom and LMS counts align for matched learners.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Participants panel */}
          <div
            className={[
              "relative flex flex-col overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_2px_10px_rgba(0,0,0,0.02)]",
              showStale ? "opacity-80" : "",
            ].join(" ")}
          >
            {selectedIds.length > 0 ? (
              <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-primary-container)] px-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="flex h-4 w-4 items-center justify-center rounded bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    onClick={() => {
                      setSelectedIds([]);
                    }}
                    aria-label="Clear selection"
                  >
                    <span className="text-[10px] leading-none">−</span>
                  </button>
                  <span className="text-sm font-semibold text-[var(--admin-primary)]">
                    {formatCount(selectedIds.length)} participants selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className={secondaryButtonClassName} disabled>
                    Message Selected
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={busy}
                    onClick={() => {
                      void loadParticipants();
                    }}
                  >
                    Force Sync LMS
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-surface)_50%,transparent)]"
                    onClick={() => {
                      setSelectedIds([]);
                    }}
                    aria-label="Close selection"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
                    aria-hidden="true"
                  />
                  <input
                    id={searchId}
                    className={`${fieldClassName} pl-9`}
                    placeholder="Search attendees…"
                    value={draftSearch}
                    onChange={(event) => {
                      setDraftSearch(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applySearch();
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={[
                      secondaryButtonClassName,
                      filtersOpen
                        ? "border-[var(--admin-primary)] bg-[var(--admin-primary-container)] text-[var(--admin-primary)]"
                        : "",
                    ].join(" ")}
                    onClick={() => {
                      setFiltersOpen((open) => !open);
                    }}
                  >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    Filter
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      className={[
                        secondaryButtonClassName,
                        columnsOpen
                          ? "border-[var(--admin-primary)] bg-[var(--admin-primary-container)] text-[var(--admin-primary)]"
                          : "",
                      ].join(" ")}
                      onClick={() => {
                        setDraftColumns(columns);
                        setColumnsOpen((open) => !open);
                      }}
                    >
                      <Columns3 className="h-4 w-4" aria-hidden="true" />
                      Columns
                    </button>
                    {columnsOpen ? (
                      <div className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-[280px] flex-col overflow-hidden rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] shadow-[0_8px_24px_rgba(27,27,35,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                            Manage Columns
                          </h3>
                          <button
                            type="button"
                            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                            onClick={() => {
                              setColumnsOpen(false);
                            }}
                            aria-label="Close columns"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto p-2">
                          <p className="mb-1 mt-1 px-2 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                            Identity &amp; Timing
                          </p>
                          {ZOOM_PARTICIPANT_COLUMN_OPTIONS.filter(
                            (c) => c.group === "identity",
                          ).map((column) => (
                            <label
                              key={column.key}
                              className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-[var(--admin-surface-high)]"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                checked={draftColumns.includes(column.key)}
                                onChange={() => {
                                  setDraftColumns((current) => {
                                    if (current.includes(column.key)) {
                                      if (current.length === 1) return current;
                                      return current.filter((key) => key !== column.key);
                                    }
                                    return [...current, column.key];
                                  });
                                }}
                              />
                              <span className="flex-1 select-none text-sm text-[var(--admin-on-surface)]">
                                {column.label}
                              </span>
                            </label>
                          ))}
                          <div className="mx-2 my-2 h-px bg-[var(--admin-border)]" />
                          <p className="mb-1 px-2 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                            Metrics &amp; Quality
                          </p>
                          {ZOOM_PARTICIPANT_COLUMN_OPTIONS.filter((c) => c.group === "metrics").map(
                            (column) => (
                              <label
                                key={column.key}
                                className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-[var(--admin-surface-high)]"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                  checked={draftColumns.includes(column.key)}
                                  onChange={() => {
                                    setDraftColumns((current) => {
                                      if (current.includes(column.key)) {
                                        if (current.length === 1) return current;
                                        return current.filter((key) => key !== column.key);
                                      }
                                      return [...current, column.key];
                                    });
                                  }}
                                />
                                <span className="flex-1 select-none text-sm text-[var(--admin-on-surface)]">
                                  {column.label}
                                </span>
                              </label>
                            ),
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                            onClick={() => {
                              setDraftColumns([...DEFAULT_ZOOM_PARTICIPANT_COLUMNS]);
                            }}
                          >
                            Reset to default
                          </button>
                          <button
                            type="button"
                            className={`${primaryButtonClassName} h-8 px-4`}
                            onClick={() => {
                              setColumns(draftColumns);
                              setColumnsOpen(false);
                              setPage(1);
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className={ghostButtonClassName} onClick={applySearch}>
                    Search
                  </button>
                </div>
              </div>
            )}

            {filtersOpen ? (
              <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
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
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Match state
                  <select
                    className={fieldClassName}
                    value={matchState}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMatchState(
                        value === "matched" || value === "unmatched" || value === "guest"
                          ? value
                          : "all",
                      );
                      setPage(1);
                    }}
                  >
                    <option value="all">All</option>
                    <option value="matched">Matched</option>
                    <option value="unmatched">Unmatched</option>
                    <option value="guest">Guest</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Duration
                  <select
                    className={fieldClassName}
                    value={durationBucket}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDurationBucket(
                        value === "under_10" || value === "10_to_30" || value === "over_30"
                          ? value
                          : "any",
                      );
                      setPage(1);
                    }}
                  >
                    <option value="any">Any</option>
                    <option value="under_10">Under 10m</option>
                    <option value="10_to_30">10–30m</option>
                    <option value="over_30">Over 30m</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
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
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
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
                <label className="flex h-9 items-center gap-2 text-xs text-[var(--admin-on-surface)]">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)]"
                    checked={rejoinedOnly}
                    onChange={(event) => {
                      setRejoinedOnly(event.target.checked);
                      setPage(1);
                    }}
                  />
                  Rejoined only
                </label>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    setDisplayName(draftSearch);
                    setPage(1);
                  }}
                >
                  Apply filters
                </button>
              </div>
            ) : null}

            {participantError ? (
              <div className="m-4 flex flex-wrap items-center justify-between gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
                    <AlertTriangle
                      className="h-5 w-5 text-[var(--admin-danger)]"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-[15px] font-medium text-[var(--admin-on-surface)]">
                      Couldn&apos;t load participant data for this meeting.
                    </p>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {participantError}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded border border-[var(--admin-danger)] px-6 text-sm font-medium text-[var(--admin-danger)] transition-transform hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] active:translate-y-px"
                  onClick={() => void loadParticipants()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry Connection
                </button>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="w-10 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                        checked={
                          participants.length > 0 && selectedIds.length === participants.length
                        }
                        onChange={toggleSelectAll}
                        aria-label="Select all on page"
                      />
                    </th>
                    {columns.includes("display_name") || columns.includes("email") ? (
                      <th className="px-4">Participant Details</th>
                    ) : null}
                    {columns.includes("match_state") ? <th className="px-4">Match State</th> : null}
                    {columns.includes("join_time") || columns.includes("leave_time") ? (
                      <th className="px-4 text-right">Joined / Left</th>
                    ) : null}
                    {columns.includes("duration_seconds") || columns.includes("coverage") ? (
                      <th className="w-[200px] px-4">Duration Coverage</th>
                    ) : null}
                    {columns.includes("rejoins") ? (
                      <th className="w-24 px-4 text-center">Rejoined</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {participants.length === 0 && !participantError ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No participants match these filters.
                      </td>
                    </tr>
                  ) : (
                    participants.map((participant) => {
                      const selected = selectedIds.includes(participant.id);
                      const unmatched = participant.matchState === "unmatched";
                      const guest = participant.matchState === "guest";
                      const duration = meetingDurationSeconds ?? detail.durationSeconds ?? 0;
                      const coverage =
                        duration > 0 && participant.durationSeconds != null
                          ? participant.durationSeconds / duration
                          : 0;
                      const barTone =
                        unmatched || guest ? "warning" : coverage >= 0.9 ? "success" : "primary";
                      return (
                        <tr
                          key={participant.id}
                          className={[
                            "relative h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]",
                            selected
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                              : "",
                          ].join(" ")}
                        >
                          <td className="relative px-4 align-middle">
                            {selected ? (
                              <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-primary)]" />
                            ) : unmatched || guest ? (
                              <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-warning)]" />
                            ) : null}
                            <input
                              type="checkbox"
                              className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                              checked={selected}
                              onChange={() => {
                                toggleSelect(participant.id);
                              }}
                              aria-label={`Select ${participant.displayName ?? "participant"}`}
                            />
                          </td>
                          {columns.includes("display_name") || columns.includes("email") ? (
                            <td className="px-4 align-middle">
                              <div className="flex flex-col">
                                <Link
                                  href={`/admin/reports/zoom-insights/${meetingId}/participants/${participant.id}`}
                                  className={[
                                    "leading-tight hover:underline",
                                    selected ? "font-medium" : "font-medium",
                                    "text-[var(--admin-primary)]",
                                  ].join(" ")}
                                >
                                  {participant.displayName ??
                                    (participant.membershipId ? "Learner" : "Unknown attendee")}
                                </Link>
                                {columns.includes("email") ? (
                                  <span
                                    className={[
                                      "font-mono text-[11px]",
                                      unmatched || guest
                                        ? "text-[color-mix(in_srgb,var(--admin-warning)_80%,var(--admin-on-surface-variant))]"
                                        : "text-[var(--admin-on-surface-variant)]",
                                    ].join(" ")}
                                  >
                                    {participant.email ?? "No email provided"}
                                  </span>
                                ) : null}
                                {participant.zoomDisplayName ? (
                                  <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                    Zoom: {participant.zoomDisplayName}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                          {columns.includes("match_state") ? (
                            <td className="px-4 align-middle">
                              {participant.matchState === "matched" ? (
                                <StatusPill tone="success">Matched</StatusPill>
                              ) : participant.matchState === "guest" ? (
                                <StatusPill tone="muted">Guest</StatusPill>
                              ) : (
                                <StatusPill tone="warning">
                                  <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                  Unmatched
                                </StatusPill>
                              )}
                            </td>
                          ) : null}
                          {columns.includes("join_time") || columns.includes("leave_time") ? (
                            <td className="px-4 text-right align-middle font-mono text-[var(--admin-on-surface-variant)]">
                              {formatTime(participant.joinTime)} –{" "}
                              {formatTime(participant.leaveTime)}
                            </td>
                          ) : null}
                          {columns.includes("duration_seconds") || columns.includes("coverage") ? (
                            <td className="px-4 align-middle">
                              <div className="flex items-center gap-2">
                                {columns.includes("duration_seconds") ? (
                                  <span className="w-12 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {formatDuration(participant.durationSeconds)}
                                  </span>
                                ) : null}
                                {columns.includes("coverage") ? (
                                  <CoverageBar
                                    ratio={coverage}
                                    tone={barTone}
                                    fractured={participant.rejoinCount > 0}
                                  />
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                          {columns.includes("rejoins") ? (
                            <td className="px-4 text-center align-middle">
                              {participant.rejoinCount > 0 ? (
                                <span
                                  className={[
                                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-medium",
                                    participant.rejoinCount >= 3
                                      ? "border border-[color-mix(in_srgb,var(--admin-danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]"
                                      : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                                  ].join(" ")}
                                >
                                  {participant.rejoinCount >= 3
                                    ? `x${String(participant.rejoinCount)}`
                                    : String(participant.rejoinCount)}
                                </span>
                              ) : (
                                <span className="text-[var(--admin-on-surface-variant)]">—</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex h-11 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{" "}
                {formatCount(totalCount)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded text-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                  disabled={totalPages === 0 || page >= totalPages}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Reported by Zoom. Durations come from Zoom&apos;s participant records and may differ
            from LMS session attendance.
            {detail.biggestDropCount > 0 && detail.biggestDropFrom ? (
              <>
                {" "}
                Largest concurrent drop: {formatCount(detail.biggestDropCount)} around{" "}
                {formatTime(detail.biggestDropFrom)}.
              </>
            ) : null}
          </p>
        </>
      )}

      {error ? (
        <div className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="text-xs text-[var(--admin-on-surface-variant)]">{label}</p>
      <p className="mt-2 font-mono text-xl text-[var(--admin-on-surface)]">{value}</p>
    </div>
  );
}
