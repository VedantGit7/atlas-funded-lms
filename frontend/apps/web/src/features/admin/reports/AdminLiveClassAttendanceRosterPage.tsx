"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  Presentation,
  Search,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportLiveClassAttendanceReport,
  fetchLiveClassSessionsRoster,
  type LiveAttendanceRateBand,
  type LiveSessionListItem,
  type LiveSessionsListSummary,
} from "./admin-live-class-attendance-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ModuleTab = "sessions" | "learners" | "series" | "exports";
type DatePreset = "7d" | "30d" | "90d" | "custom";
type SavedView = "all" | "low_turnout" | "upcoming" | "cancelled";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-transparent px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const EMPTY_SUMMARY: LiveSessionsListSummary = {
  sessionsHeld: 0,
  cancelledCount: 0,
  scheduledAheadCount: 0,
  avgAttendancePct: null,
  totalAttendedCount: 0,
  totalRegisteredCount: 0,
  totalTimeSeconds: 0,
  avgCoveragePct: null,
  lowTurnoutCount: 0,
};

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:-translate-x-full",
        "motion-safe:after:animate-[shimmer_1.8s_infinite]",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent",
        "motion-safe:after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] motion-safe:after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(secs).padStart(2, "0")}s`;
  return `${String(secs)}s`;
}

function formatDurationParts(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(seconds));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
  };
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function attendanceRate(attended: number, registered: number): number | null {
  if (registered <= 0) return null;
  return (attended / registered) * 100;
}

function coveragePct(
  avgCoverageSeconds: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null {
  if (
    avgCoverageSeconds == null ||
    durationSeconds == null ||
    durationSeconds <= 0 ||
    Number.isNaN(avgCoverageSeconds) ||
    Number.isNaN(durationSeconds)
  ) {
    return null;
  }
  return Math.min(100, (avgCoverageSeconds / durationSeconds) * 100);
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(from.getDate() - 7);
  else if (preset === "30d") from.setDate(from.getDate() - 30);
  else if (preset === "90d") from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function sessionStatusTone(status: string): "success" | "warning" | "danger" | "muted" | "primary" {
  if (status === "live") return "success";
  if (status === "scheduled") return "warning";
  if (status === "cancelled") return "danger";
  return "muted";
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
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function MetricBar({
  pct,
  tone = "primary",
}: {
  pct: number | null;
  tone?: "primary" | "success" | "warning";
}) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  const fill =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : "bg-[var(--admin-primary-strong)]";
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-out ${fill}`}
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}

function SessionsLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading live class attendance"
    >
      <div className="grid grid-cols-12 gap-4 md:gap-8">
        <div className="relative col-span-12 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="mb-4 h-9 w-16" />
          <Shimmer className="h-3 w-40" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2"
          >
            <Shimmer className="mb-2 h-3 w-20" />
            <Shimmer className="mb-3 h-8 w-14" />
            <Shimmer className="h-[3px] w-full" />
            <Shimmer className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex items-end gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <div className="w-48">
            <Shimmer className="mb-2 h-3 w-16" />
            <Shimmer className="h-8 w-full" />
          </div>
          <div className="w-32">
            <Shimmer className="mb-2 h-3 w-12" />
            <Shimmer className="h-8 w-full" />
          </div>
        </div>
        <div className="flex h-9 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-3 w-[20%]" />
          <Shimmer className="h-3 w-[15%]" />
          <Shimmer className="h-3 w-[25%]" />
          <Shimmer className="h-3 w-[20%]" />
          <Shimmer className="h-3 w-[20%]" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            style={{ animationDelay: `${String(index * 80)}ms` }}
          >
            <Shimmer className="h-4 w-[20%]" />
            <Shimmer className="h-4 w-[15%]" />
            <Shimmer className="h-4 w-[25%]" />
            <Shimmer className="h-4 w-[20%]" />
            <div className="flex w-[20%] items-center gap-2">
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-1 flex-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminLiveClassAttendanceRosterPage() {
  const router = useRouter();
  const datePresetLabelId = useId();
  const [moduleTab, setModuleTab] = useState<ModuleTab>("sessions");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<LiveSessionListItem[]>([]);
  const [summary, setSummary] = useState<LiveSessionsListSummary>(EMPTY_SUMMARY);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(0);
  const [sessionsTotalCount, setSessionsTotalCount] = useState(0);

  const initialRange = presetToRange("30d");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [startedFrom, setStartedFrom] = useState(initialRange.from);
  const [startedTo, setStartedTo] = useState(initialRange.to);
  const [savedView, setSavedView] = useState<SavedView>("all");

  const [searchQ, setSearchQ] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [attendanceRateBand, setAttendanceRateBand] = useState<LiveAttendanceRateBand | "">("");

  const datePresetLabel =
    datePreset === "7d"
      ? "Last 7 days"
      : datePreset === "90d"
        ? "Last 90 days"
        : datePreset === "custom"
          ? "Custom range"
          : "Last 30 days";

  const applyDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setStartedFrom(range.from);
    setStartedTo(range.to);
    setSessionsPage(1);
  }, []);

  const applySavedView = useCallback((view: SavedView) => {
    setSavedView(view);
    setSessionsPage(1);
    setSelectedIds(new Set());
    if (view === "all") {
      setSessionStatus("");
      setAttendanceRateBand("");
      return;
    }
    if (view === "low_turnout") {
      setSessionStatus("");
      setAttendanceRateBand("below_40");
      return;
    }
    if (view === "upcoming") {
      setSessionStatus("scheduled");
      setAttendanceRateBand("");
      return;
    }
    setSessionStatus("cancelled");
    setAttendanceRateBand("");
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveClassSessionsRoster({
        q: searchQ.trim() || undefined,
        status: sessionStatus || undefined,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        attendanceRateBand: attendanceRateBand || undefined,
        page: sessionsPage,
      });
      setSessions(response.data.items);
      setSummary(response.data.summary);
      setSessionsTotalPages(response.data.pageInfo.totalPages);
      setSessionsTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load live sessions.",
      );
      setSessions([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [attendanceRateBand, searchQ, sessionStatus, sessionsPage, startedFrom, startedTo]);

  useEffect(() => {
    if (moduleTab === "sessions") {
      void loadSessions();
    }
  }, [loadSessions, moduleTab]);

  function openSession(session: LiveSessionListItem, options?: { messageAbsentees?: boolean }) {
    const query = options?.messageAbsentees ? "?message=absentees" : "";
    router.push(`/admin/reports/live-class-attendance/${session.id}${query}`);
  }

  async function handleExportSessions() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportLiveClassAttendanceReport({
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
      const visibleIds = sessions.map((session) => session.id);
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

  const selectedRegistrationCount = useMemo(() => {
    return sessions
      .filter((session) => selectedIds.has(session.id))
      .reduce((sum, session) => sum + session.registeredCount, 0);
  }, [selectedIds, sessions]);

  const totalTimeParts = formatDurationParts(summary.totalTimeSeconds);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary-strong)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary-strong)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-on-surface)]">Live Class Attendance</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Live Class Attendance
          </h1>
          <p className="mt-1 max-w-[65ch] text-sm text-[var(--admin-on-surface-variant)]">
            Monitor and analyze attendance metrics across all live sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <DropdownField
              label={<span className="sr-only">Date range</span>}
              labelId={datePresetLabelId}
              open={dateMenuOpen}
              onToggle={() => {
                setDateMenuOpen((open) => !open);
              }}
              triggerContent={
                <span className="flex w-full items-center gap-2 text-[13px] font-medium text-[var(--admin-on-surface)]">
                  <Calendar
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{datePresetLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${dateMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              }
              panelAriaLabel="Date range presets"
            >
              <div className="p-1.5" role="listbox">
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["90d", "Last 90 days"],
                    ["custom", "Custom"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={datePreset === value}
                    className={dropdownItemClassName}
                    onClick={() => {
                      applyDatePreset(value);
                      setDateMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExportSessions()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={selectedIds.size === 0}
            title={
              selectedIds.size === 0
                ? "Select one or more sessions to message absentees"
                : undefined
            }
            onClick={() => {
              const firstSelected = sessions.find((session) => selectedIds.has(session.id));
              if (!firstSelected) return;
              openSession(firstSelected, { messageAbsentees: true });
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message absentees
          </button>
        </div>
      </div>

      {datePreset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            From
            <input
              type="date"
              className={fieldClassName}
              value={startedFrom}
              onChange={(event) => {
                setStartedFrom(event.target.value);
                setSessionsPage(1);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
            To
            <input
              type="date"
              className={fieldClassName}
              value={startedTo}
              onChange={(event) => {
                setStartedTo(event.target.value);
                setSessionsPage(1);
              }}
            />
          </label>
        </div>
      ) : null}

      <div className="flex gap-8 border-b border-[var(--admin-border)]">
        {(
          [
            ["sessions", "Sessions"],
            ["learners", "Learners"],
            ["series", "Series"],
            ["exports", "Exports"],
          ] as const
        ).map(([value, label]) => {
          const active = moduleTab === value;
          return (
            <button
              key={value}
              type="button"
              className={[
                "pb-3 text-sm transition-colors",
                active
                  ? "border-b-2 border-[var(--admin-primary-strong)] font-semibold text-[var(--admin-primary-strong)]"
                  : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
              onClick={() => {
                if (value === "learners") {
                  router.push("/admin/reports/live-class-attendance/learners");
                  return;
                }
                if (value === "series") {
                  router.push("/admin/reports/live-class-attendance/series");
                  return;
                }
                if (value === "exports") {
                  router.push("/admin/reports/live-class-attendance/exports");
                  return;
                }
                setModuleTab(value);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {moduleTab !== "sessions" ? (
        <section className="flex flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
            <Presentation className="h-7 w-7 text-[var(--admin-outline)]" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            Opening module…
          </h2>
          <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Sessions remains the live source of truth while related modules load.
          </p>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setModuleTab("sessions");
            }}
          >
            Back to Sessions
          </button>
        </section>
      ) : null}

      {moduleTab === "sessions" ? (
        <>
          {error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {error.includes("Couldn't load") ? "Couldn't load live sessions." : error}
                </span>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-3 py-1 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]"
                onClick={() => void loadSessions()}
              >
                Retry
              </button>
            </div>
          ) : null}

          {loading && sessions.length === 0 && !error ? (
            <SessionsLoadingSkeleton />
          ) : !loading && sessions.length === 0 && !error ? (
            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <Presentation
                    className="h-7 w-7 text-[var(--admin-outline)]"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  No live sessions in this range
                </h2>
                <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  Sessions appear here once they are scheduled in a course or batch.
                </p>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    applyDatePreset("30d");
                    applySavedView("all");
                    setSearchQ("");
                  }}
                >
                  Reset date range
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-4 md:gap-8">
                <div className="relative col-span-12 flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-4">
                  <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Sessions held
                    </h3>
                    <div className="font-mono text-3xl font-semibold text-[var(--admin-on-surface)]">
                      {formatCount(summary.sessionsHeld)}
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">
                    {formatCount(summary.cancelledCount)} cancelled ·{" "}
                    {formatCount(summary.scheduledAheadCount)} scheduled ahead
                  </p>
                </div>

                <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Avg attendance
                    </h3>
                    <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                      {formatPct(summary.avgAttendancePct)}
                    </div>
                  </div>
                  <div className="mt-3">
                    <MetricBar pct={summary.avgAttendancePct} />
                    <p className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatCount(summary.totalAttendedCount)} of{" "}
                      {formatCount(summary.totalRegisteredCount)} reg.
                    </p>
                  </div>
                </div>

                <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Total time
                    </h3>
                    <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                      {totalTimeParts.hours}
                      <span className="text-sm font-normal text-[var(--admin-on-surface-variant)]">
                        h
                      </span>{" "}
                      {totalTimeParts.minutes}
                      <span className="text-sm font-normal text-[var(--admin-on-surface-variant)]">
                        m
                      </span>
                    </div>
                  </div>
                  <p className="mt-auto text-xs text-[var(--admin-on-surface-variant)]">
                    Delivered this period
                  </p>
                </div>

                <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-6 md:col-span-2">
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Avg coverage
                    </h3>
                    <div className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                      {formatPct(summary.avgCoveragePct)}
                    </div>
                  </div>
                  <div className="mt-3">
                    <MetricBar pct={summary.avgCoveragePct} tone="success" />
                    <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                      of session length
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="col-span-12 flex flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_5%,var(--admin-surface))] p-5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] active:translate-y-px sm:col-span-6 md:col-span-2"
                  onClick={() => {
                    applySavedView("low_turnout");
                  }}
                >
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-warning)]">
                      Low turnout
                    </h3>
                    <div className="font-mono text-2xl font-semibold text-[var(--admin-warning)]">
                      {formatCount(summary.lowTurnoutCount)}
                    </div>
                  </div>
                  <p className="mt-auto text-xs leading-tight text-[var(--admin-warning)]">
                    Sessions below 40%
                  </p>
                </button>
              </div>

              <p className="text-xs italic text-[var(--admin-on-surface-variant)]">
                Attendance rate is attendees divided by registrations.
              </p>

              {selectedIds.size > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    <span className="font-semibold">{formatCount(selectedIds.size)}</span> session
                    {selectedIds.size === 1 ? "" : "s"} selected ·{" "}
                    <span className="font-mono">{formatCount(selectedRegistrationCount)}</span>{" "}
                    registrations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => void handleExportSessions()}
                    >
                      Export selection
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      onClick={() => {
                        setSelectedIds(new Set());
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <label className="grid min-w-[200px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Search session title
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      <input
                        className={`${fieldClassName} w-full pl-9`}
                        value={searchQ}
                        onChange={(event) => {
                          setSearchQ(event.target.value);
                        }}
                        placeholder="Session title"
                      />
                    </div>
                  </label>
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Status
                    <select
                      className={fieldClassName}
                      value={sessionStatus}
                      onChange={(event) => {
                        setSessionStatus(event.target.value);
                        setSavedView("all");
                        setSessionsPage(1);
                      }}
                    >
                      <option value="">All</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="ended">Ended</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Attendance rate
                    <select
                      className={fieldClassName}
                      value={attendanceRateBand}
                      onChange={(event) => {
                        const value = event.target.value as LiveAttendanceRateBand | "";
                        setAttendanceRateBand(value);
                        setSavedView(value === "below_40" ? "low_turnout" : "all");
                        setSessionsPage(1);
                      }}
                    >
                      <option value="">Any</option>
                      <option value="below_40">Below 40%</option>
                      <option value="mid_40_75">40-75%</option>
                      <option value="above_75">Above 75%</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    onClick={() => {
                      if (sessionsPage !== 1) setSessionsPage(1);
                      else void loadSessions();
                    }}
                  >
                    Search
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] px-4 py-3">
                  {(
                    [
                      ["all", "All sessions"],
                      ["low_turnout", "Low turnout"],
                      ["upcoming", "Upcoming"],
                      ["cancelled", "Cancelled"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={[
                        "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                        savedView === value
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                          : "bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                      onClick={() => {
                        applySavedView(value);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      <tr>
                        <th className="w-11 px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select all visible sessions"
                            checked={
                              sessions.length > 0 &&
                              sessions.every((session) => selectedIds.has(session.id))
                            }
                            onChange={toggleSelectAllVisible}
                          />
                        </th>
                        <th className="px-4 py-3">Session</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Scheduled</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Registered</th>
                        <th className="px-4 py-3">Attended</th>
                        <th className="px-4 py-3">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => {
                        const rate = attendanceRate(
                          session.attendanceCount,
                          session.registeredCount,
                        );
                        const coverage = coveragePct(
                          session.avgCoverageSeconds,
                          session.durationSeconds,
                        );
                        const cancelled = session.status === "cancelled";
                        const selected = selectedIds.has(session.id);
                        return (
                          <tr
                            key={session.id}
                            className={[
                              "h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors",
                              selected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                                : "hover:bg-[var(--admin-surface-high)]",
                            ].join(" ")}
                            onClick={() => {
                              openSession(session);
                            }}
                          >
                            <td
                              className="px-4 py-3"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Select ${session.title}`}
                                checked={selected}
                                onChange={() => {
                                  toggleSelected(session.id);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[var(--admin-primary)]">
                                {session.title}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                                <span className="rounded border border-[var(--admin-border)] px-1.5 py-0.5">
                                  {session.courseTitle ?? "No linked course"}
                                </span>
                                <span className="rounded border border-[var(--admin-border)] px-1.5 py-0.5">
                                  {session.batchName ?? "No linked batch"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill tone={sessionStatusTone(session.status)}>
                                {titleCase(session.status)}
                              </StatusPill>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                              {formatDate(session.startedAt ?? session.scheduledAt)}
                            </td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {cancelled ? "-" : formatDuration(session.durationSeconds)}
                            </td>
                            <td className="px-4 py-3 font-mono text-[13px]">
                              {formatCount(session.registeredCount)}
                            </td>
                            <td className="px-4 py-3">
                              {cancelled ? (
                                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                                  Session cancelled
                                </span>
                              ) : session.registeredCount === 0 ? (
                                <span className="font-mono text-[13px]">
                                  {formatCount(session.attendanceCount)}
                                  <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                                    No registrations recorded
                                  </span>
                                </span>
                              ) : (
                                <div className="min-w-[120px]">
                                  <div
                                    className={[
                                      "font-mono text-[13px]",
                                      rate != null && rate < 40
                                        ? "text-[var(--admin-warning)]"
                                        : "text-[var(--admin-on-surface)]",
                                    ].join(" ")}
                                  >
                                    {formatCount(session.attendanceCount)} of{" "}
                                    {formatCount(session.registeredCount)}
                                    <span className="ml-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {formatPct(rate)}
                                    </span>
                                  </div>
                                  <div className="mt-1.5">
                                    <MetricBar
                                      pct={rate}
                                      tone={rate != null && rate < 40 ? "warning" : "primary"}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {cancelled ? (
                                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                                  -
                                </span>
                              ) : (
                                <div className="min-w-[88px]">
                                  <div className="font-mono text-[13px]">{formatPct(coverage)}</div>
                                  <div className="mt-1.5">
                                    <MetricBar pct={coverage} tone="success" />
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Showing{" "}
                    <span className="font-mono">
                      {sessionsTotalCount === 0
                        ? "0"
                        : `${String((sessionsPage - 1) * 50 + 1)}-${String((sessionsPage - 1) * 50 + sessions.length)}`}
                    </span>{" "}
                    of <span className="font-mono">{formatCount(sessionsTotalCount)}</span> sessions
                  </p>
                  {sessionsTotalPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={ghostButtonClassName}
                        disabled={sessionsPage <= 1 || loading}
                        onClick={() => {
                          setSessionsPage((current) => Math.max(1, current - 1));
                        }}
                      >
                        Previous
                      </button>
                      <span className="text-sm text-[var(--admin-on-surface-variant)]">
                        Page {sessionsPage} of {sessionsTotalPages}
                      </span>
                      <button
                        type="button"
                        className={ghostButtonClassName}
                        disabled={sessionsPage >= sessionsTotalPages || loading}
                        onClick={() => {
                          setSessionsPage((current) => current + 1);
                        }}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
