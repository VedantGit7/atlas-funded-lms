"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ArrowLeftRight,
  Download,
  GripVertical,
  Info,
  Search,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  SUPER_LIVE_INSIGHT_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportSuperLiveInsightsReport,
  fetchSuperLiveInsightsRoster,
  type SuperLiveInsightColumnKey,
  type SuperLiveInsightItem,
  type SuperLiveInsightsSummary,
} from "./admin-super-live-insights-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import {
  SuperLiveInsightsModuleTabs,
  type SuperLiveInsightsTabId,
} from "./SuperLiveInsightsModuleTabs";

type ModuleTab = SuperLiveInsightsTabId;
type DatePreset = "7d" | "30d" | "90d" | "custom";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const DEFAULT_COLUMNS: SuperLiveInsightColumnKey[] = [
  "title",
  "status",
  "course_title",
  "scheduled_at",
  "started_at",
  "duration_seconds",
  "attended_count",
  "registered_count",
  "avg_duration_seconds",
  "attendance_rate",
];

const SESSION_COLUMN_KEYS: SuperLiveInsightColumnKey[] = [
  "title",
  "status",
  "course_title",
  "batch_name",
  "scheduled_at",
  "started_at",
  "ended_at",
  "duration_seconds",
];

const METRIC_COLUMN_KEYS: SuperLiveInsightColumnKey[] = [
  "attended_count",
  "registered_count",
  "absent_count",
  "total_count",
  "avg_duration_seconds",
  "attendance_rate",
];

const EMPTY_SUMMARY: SuperLiveInsightsSummary = {
  sessionCount: 0,
  totalAttended: 0,
  totalRegistered: 0,
  totalAbsent: 0,
  totalRecords: 0,
  avgAttendanceRate: null,
  avgDurationSeconds: null,
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

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
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

function columnLabel(key: SuperLiveInsightColumnKey): string {
  return SUPER_LIVE_INSIGHT_COLUMN_OPTIONS.find((column) => column.key === key)?.label ?? key;
}

function sessionStatusTone(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "live") return "success";
  if (status === "scheduled") return "warning";
  if (status === "cancelled") return "danger";
  return "muted";
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted";
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
        : "bg-[var(--admin-primary)]";
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-out ${fill}`}
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}

function InsightsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading Super Live Insights">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
          <div className="mb-6 grid gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-8 w-16" />
                <Shimmer className="h-2 w-28" />
              </div>
            ))}
          </div>
          <Shimmer className="h-12 w-full rounded" />
        </div>
        <div className="col-span-12 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
          <Shimmer className="mb-4 h-3 w-32" />
          <Shimmer className="mb-4 h-4 w-full" />
          <div className="mb-6 flex justify-between gap-3">
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-8 w-16" />
          </div>
          <Shimmer className="h-3 w-48" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-3 w-1/3" />
          <Shimmer className="h-3 w-1/4" />
          <Shimmer className="h-3 w-1/4" />
          <Shimmer className="ml-auto h-3 w-1/6" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-1/3" />
            <Shimmer className="h-4 w-1/4" />
            <Shimmer className="h-4 w-1/4" />
            <Shimmer className="ml-auto h-4 w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnsPopover({
  open,
  onClose,
  columns,
  onApply,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  columns: SuperLiveInsightColumnKey[];
  onApply: (next: SuperLiveInsightColumnKey[]) => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}) {
  const [draft, setDraft] = useState(columns);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(columns);
  }, [columns, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  function toggle(key: SuperLiveInsightColumnKey) {
    setDraft((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  function renderGroup(label: string, keys: SuperLiveInsightColumnKey[]) {
    return (
      <div className="mb-3 last:mb-0">
        <div className="mb-1 border-t border-[var(--admin-border)] px-2 pb-1 pt-3 first:border-t-0 first:pt-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            {label}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {keys.map((key) => {
            const checked = draft.includes(key);
            return (
              <label
                key={key}
                className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--admin-surface-high)]"
              >
                <GripVertical
                  className="h-4 w-4 text-[var(--admin-on-surface-variant)] opacity-40 group-hover:opacity-100"
                  aria-hidden="true"
                />
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  checked={checked}
                  onChange={() => {
                    toggle(key);
                  }}
                />
                <span className="flex-1 text-sm text-[var(--admin-on-surface)]">
                  {columnLabel(key)}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`absolute right-0 top-[calc(100%+8px)] z-30 flex w-[320px] max-h-[80vh] flex-col overflow-hidden bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`}
      role="dialog"
      aria-label="Manage columns"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Manage Columns</h3>
        <button
          type="button"
          className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          aria-label="Close columns"
          onClick={onClose}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {renderGroup("Session details", SESSION_COLUMN_KEYS)}
        {renderGroup("Metrics", METRIC_COLUMN_KEYS)}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          onClick={() => {
            setDraft(DEFAULT_COLUMNS);
          }}
        >
          Reset to default
        </button>
        <button
          type="button"
          className="rounded-lg bg-[var(--admin-primary)] px-4 py-1.5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)] active:translate-y-px"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function AdminSuperLiveInsightsRosterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datePresetLabelId = useId();
  const columnsButtonRef = useRef<HTMLButtonElement>(null);

  const tabFromUrl = searchParams.get("tab");
  const initialTab: ModuleTab =
    tabFromUrl === "compare" ||
    tabFromUrl === "outliers" ||
    tabFromUrl === "exports" ||
    tabFromUrl === "trends"
      ? tabFromUrl
      : "sessions";

  const [moduleTab, setModuleTab] = useState<ModuleTab>(
    initialTab === "trends" ? "sessions" : initialTab,
  );
  const courseIdFilter = searchParams.get("courseId")?.trim() || undefined;
  const batchIdFilter = searchParams.get("batchId")?.trim() || undefined;

  useEffect(() => {
    if (initialTab === "trends") {
      router.replace("/admin/reports/super-live-insights/trends");
    } else if (initialTab === "compare") {
      router.replace("/admin/reports/super-live-insights/compare");
    } else if (initialTab === "outliers") {
      router.replace("/admin/reports/super-live-insights/outliers");
    } else if (initialTab === "exports") {
      router.replace("/admin/reports/super-live-insights/exports");
    }
  }, [initialTab, router]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SuperLiveInsightItem[]>([]);
  const [summary, setSummary] = useState<SuperLiveInsightsSummary>(EMPTY_SUMMARY);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const initialRange = presetToRange("30d");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [startedFrom, setStartedFrom] = useState(initialRange.from);
  const [startedTo, setStartedTo] = useState(initialRange.to);

  const [searchQ, setSearchQ] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [minAttended, setMinAttended] = useState("");
  const [hasUnresolved, setHasUnresolved] = useState(false);
  const [sortBy, setSortBy] = useState("scheduled_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<SuperLiveInsightColumnKey[]>(DEFAULT_COLUMNS);

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
    setPage(1);
  }, []);

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
        courseId: courseIdFilter,
        batchId: batchIdFilter,
        startedFrom: dateInputToStartIso(startedFrom),
        startedTo: dateInputToEndIso(startedTo),
        minAttended: min,
        hasUnresolved: hasUnresolved || undefined,
        sortBy,
        sortDir,
        columns,
        page,
      });
      setSessions(response.data.items);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load live session insights.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    batchIdFilter,
    columns,
    courseIdFilter,
    hasUnresolved,
    minAttended,
    page,
    searchQ,
    sessionStatus,
    sortBy,
    sortDir,
    startedFrom,
    startedTo,
  ]);

  useEffect(() => {
    if (tabFromUrl === "compare" || tabFromUrl === "outliers" || tabFromUrl === "exports") {
      setModuleTab(tabFromUrl);
    } else if (!tabFromUrl) {
      setModuleTab("sessions");
    }
  }, [tabFromUrl]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  function openSession(session: SuperLiveInsightItem) {
    router.push(`/admin/reports/super-live-insights/${session.id}`);
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

  function resetFilters() {
    applyDatePreset("30d");
    setSearchQ("");
    setSessionStatus("");
    setMinAttended("");
    setHasUnresolved(false);
    setSortBy("scheduled_at");
    setSortDir("desc");
    setPage(1);
    setSelectedIds(new Set());
  }

  const composition = useMemo(() => {
    const total = summary.totalRecords;
    const attended = summary.totalAttended;
    const registered = summary.totalRegistered;
    const absent = summary.totalAbsent;
    return {
      attendedPct: sharePct(attended, total),
      registeredPct: sharePct(registered, total),
      absentPct: sharePct(absent, total),
      attended,
      registered,
      absent,
      total,
    };
  }, [summary]);

  const rateTone =
    summary.avgAttendanceRate != null && summary.avgAttendanceRate < 40 ? "warning" : "success";

  const pageStart = totalCount === 0 ? 0 : (page - 1) * 50 + 1;
  const pageEnd = Math.min(page * 50, totalCount);

  const selectedCompareSessions = useMemo(
    () => sessions.filter((session) => selectedIds.has(session.id)),
    [selectedIds, sessions],
  );

  return (
    <div className="space-y-6">
      <nav
        className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-on-surface)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Super Live Insights</span>
      </nav>

      <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Super Live Insights
            </h1>
            <p className="mt-1 max-w-[65ch] text-sm text-[var(--admin-on-surface-variant)]">
              Attendance performance across every live session, measured against the tenant average.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[180px]">
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

            <div className="relative">
              <button
                ref={columnsButtonRef}
                type="button"
                className={secondaryButtonClassName}
                aria-expanded={columnsOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  setColumnsOpen((open) => !open);
                }}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns
              </button>
              <ColumnsPopover
                open={columnsOpen}
                onClose={() => {
                  setColumnsOpen(false);
                }}
                columns={columns}
                onApply={(next) => {
                  setColumns(next);
                  setPage(1);
                }}
                anchorRef={columnsButtonRef}
              />
            </div>

            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={busy || loading}
              onClick={() => void handleExport()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>

            <button
              type="button"
              className={primaryButtonClassName}
              disabled={selectedIds.size < 2}
              title={selectedIds.size < 2 ? "Select at least two sessions to compare" : undefined}
              onClick={() => {
                const ids = [...selectedIds].slice(0, 4);
                router.push(
                  `/admin/reports/super-live-insights/compare?mode=sessions&ids=${ids.join(",")}`,
                );
              }}
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              Compare sessions
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
                  setPage(1);
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
                  setPage(1);
                }}
              />
            </label>
          </div>
        ) : null}

        <SuperLiveInsightsModuleTabs active={moduleTab === "trends" ? "sessions" : moduleTab} />

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Couldn&apos;t load live session insights.</span>
            </div>
            <button
              type="button"
              className="rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-3 py-1 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] active:translate-y-px"
              onClick={() => void loadSessions()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {moduleTab !== "sessions" ? (
          <section className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <BarChart3 className="h-7 w-7 text-[var(--admin-outline)]" aria-hidden="true" />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              {moduleTab === "compare" && selectedCompareSessions.length >= 2
                ? "Compare selected sessions"
                : `${titleCase(moduleTab)} is next`}
            </h2>
            <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              {moduleTab === "compare" && selectedCompareSessions.length >= 2
                ? "Side-by-side comparison for the selected sessions will land here. Sessions remains the source of truth until then."
                : moduleTab === "compare"
                  ? "Select at least two sessions in the Sessions table, then return here to compare."
                  : "This module tab is reserved for the next Super Live Insights screens. Use Sessions for live metrics today."}
            </p>
            {moduleTab === "compare" && selectedCompareSessions.length >= 2 ? (
              <div className="mb-6 w-full max-w-2xl overflow-hidden rounded-lg border border-[var(--admin-border)] text-left">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <tr>
                      <th className="px-4 py-3 text-left">Live class</th>
                      <th className="px-4 py-3 text-right">Attendance %</th>
                      <th className="px-4 py-3 text-right">Attended</th>
                      <th className="px-4 py-3 text-right">Avg duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCompareSessions.map((session) => (
                      <tr key={session.id} className="border-t border-[var(--admin-border)]">
                        <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                          {session.title}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatRate(session.attendanceRate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCount(session.attendedCount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatDuration(session.avgDurationSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setModuleTab("sessions");
                router.replace("/admin/reports/super-live-insights");
              }}
            >
              Back to Sessions
            </button>
          </section>
        ) : null}

        {moduleTab === "sessions" ? (
          <>
            {loading && sessions.length === 0 && !error ? (
              <InsightsLoadingSkeleton />
            ) : !loading && sessions.length === 0 && !error ? (
              <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex min-h-[360px] flex-col items-center justify-center bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] px-4 py-16 text-center">
                  <div className="mb-6 text-[var(--admin-on-surface-variant)]">
                    <BarChart3 className="mx-auto h-14 w-14 stroke-[1.25]" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                    No live sessions in this range
                  </h2>
                  <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                    Try adjusting your filters or date range to see data.
                  </p>
                  <button type="button" className={secondaryButtonClassName} onClick={resetFilters}>
                    Reset date range
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div
                  className={[
                    "grid grid-cols-12 gap-6",
                    error ? "pointer-events-none opacity-40 grayscale" : "",
                  ].join(" ")}
                >
                  <div className="col-span-12 flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-8">
                    <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:gap-8">
                      <div className="flex-1 border-[var(--admin-border)] sm:border-r sm:pr-8">
                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                          Sessions
                        </span>
                        <div className="mb-2 font-mono text-[32px] font-semibold leading-none text-[var(--admin-on-surface)]">
                          {formatCount(summary.sessionCount)}
                        </div>
                        <div className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                          <div className="h-full w-full rounded-full bg-[var(--admin-primary)]" />
                        </div>
                      </div>
                      <div className="flex-1 border-[var(--admin-border)] sm:border-r sm:pr-8">
                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                          Attendance rate
                        </span>
                        <span className="mb-2 block font-mono text-base font-semibold text-[var(--admin-on-surface)]">
                          {formatRate(summary.avgAttendanceRate)}
                        </span>
                        <div className="mb-2">
                          <MetricBar pct={summary.avgAttendanceRate} tone={rateTone} />
                        </div>
                        <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                          {formatCount(summary.totalAttended)} attended of{" "}
                          {formatCount(summary.totalRecords)} records
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--admin-on-surface-variant)]">
                              Total attended
                            </span>
                            <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatCount(summary.totalAttended)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--admin-on-surface-variant)]">
                              Total records
                            </span>
                            <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatCount(summary.totalRecords)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-[var(--admin-on-surface-variant)]">
                            Avg duration
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatDuration(summary.avgDurationSeconds)}
                            </span>
                            <div className="flex-1">
                              <MetricBar
                                pct={
                                  summary.avgDurationSeconds == null
                                    ? null
                                    : Math.min(100, (summary.avgDurationSeconds / 3600) * 100)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-[var(--admin-bg)] p-3 text-xs text-[var(--admin-on-surface-variant)]">
                      <Info
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      <div>
                        <p>Attendance rate is attended divided by all attendance records.</p>
                        <p>
                          Learner-level detail lives in{" "}
                          <Link
                            href="/admin/reports/live-class-attendance"
                            className="text-[var(--admin-primary)] hover:underline"
                          >
                            Live Class Attendance
                          </Link>
                          .
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
                    <span className="mb-4 block text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Record composition
                    </span>
                    <div className="mb-4 flex h-4 w-full overflow-hidden rounded-sm">
                      <div
                        className="h-full bg-[var(--admin-success)]"
                        style={{ width: `${String(composition.attendedPct)}%` }}
                        title={`Attended (${formatCount(composition.attended)})`}
                      />
                      <div
                        className="h-full bg-[var(--admin-warning)]"
                        style={{ width: `${String(composition.registeredPct)}%` }}
                        title={`Registered (${formatCount(composition.registered)})`}
                      />
                      <div
                        className="h-full bg-[var(--admin-danger)]"
                        style={{ width: `${String(composition.absentPct)}%` }}
                        title={`Absent (${formatCount(composition.absent)})`}
                      />
                    </div>
                    <div className="mb-6 flex justify-between gap-2 border-b border-[var(--admin-border)] pb-4 text-xs">
                      <div>
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
                          <span className="font-medium text-[var(--admin-on-surface)]">
                            Attended
                          </span>
                        </div>
                        <span className="font-mono text-[var(--admin-on-surface-variant)]">
                          {formatCount(composition.attended)} ({composition.attendedPct}%)
                        </span>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" />
                          <span className="font-medium text-[var(--admin-on-surface)]">
                            Registered
                          </span>
                        </div>
                        <span className="font-mono text-[var(--admin-on-surface-variant)]">
                          {formatCount(composition.registered)} ({composition.registeredPct}%)
                        </span>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-[var(--admin-danger)]" />
                          <span className="font-medium text-[var(--admin-on-surface)]">Absent</span>
                        </div>
                        <span className="font-mono text-[var(--admin-on-surface-variant)]">
                          {formatCount(composition.absent)} ({composition.absentPct}%)
                        </span>
                      </div>
                    </div>
                    <div className="mt-auto">
                      <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                        {formatCount(composition.registered)} records were never resolved to
                        attended or absent.
                      </p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] hover:underline"
                        onClick={() => {
                          setHasUnresolved(true);
                          setPage(1);
                        }}
                      >
                        View sessions with unresolved records
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <div className="flex flex-wrap items-end gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                    <label className="grid min-w-[200px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Search live class title
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
                          setPage(1);
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
                    <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Sort
                      <select
                        className={fieldClassName}
                        value={sortBy}
                        onChange={(event) => {
                          setSortBy(event.target.value);
                          setPage(1);
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
                    <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Direction
                      <select
                        className={fieldClassName}
                        value={sortDir}
                        onChange={(event) => {
                          setSortDir(event.target.value === "asc" ? "asc" : "desc");
                          setPage(1);
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
                  </div>

                  {(hasUnresolved || sessionStatus || searchQ.trim() || minAttended.trim()) && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2">
                      {hasUnresolved ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                          onClick={() => {
                            setHasUnresolved(false);
                            setPage(1);
                          }}
                        >
                          Unresolved records
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                        onClick={resetFilters}
                      >
                        Clear all
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    {loading ? (
                      <div className="space-y-0 p-0" aria-busy="true">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={index}
                            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4"
                          >
                            <Shimmer className="h-4 w-1/3" />
                            <Shimmer className="h-4 w-1/4" />
                            <Shimmer className="h-4 w-1/4" />
                            <Shimmer className="ml-auto h-4 w-1/6" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <table className="w-full min-w-[960px] text-left text-sm">
                        <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          <tr>
                            <th className="w-11 px-3 py-3">
                              <span className="sr-only">Select</span>
                            </th>
                            {columns.includes("title") ? (
                              <th className="px-4 py-3">Live class</th>
                            ) : null}
                            {columns.includes("status") ? (
                              <th className="px-4 py-3">Status</th>
                            ) : null}
                            {columns.includes("course_title") ? (
                              <th className="px-4 py-3">Course</th>
                            ) : null}
                            {columns.includes("batch_name") ? (
                              <th className="px-4 py-3">Batch</th>
                            ) : null}
                            {columns.includes("scheduled_at") ? (
                              <th className="px-4 py-3">Scheduled</th>
                            ) : null}
                            {columns.includes("started_at") ? (
                              <th className="px-4 py-3">Started</th>
                            ) : null}
                            {columns.includes("ended_at") ? (
                              <th className="px-4 py-3">Ended</th>
                            ) : null}
                            {columns.includes("duration_seconds") ? (
                              <th className="px-4 py-3 text-right">Duration</th>
                            ) : null}
                            {columns.includes("attended_count") ? (
                              <th className="px-4 py-3 text-right">Attended</th>
                            ) : null}
                            {columns.includes("registered_count") ? (
                              <th className="px-4 py-3 text-right">Registered</th>
                            ) : null}
                            {columns.includes("absent_count") ? (
                              <th className="px-4 py-3 text-right">Absent</th>
                            ) : null}
                            {columns.includes("total_count") ? (
                              <th className="px-4 py-3 text-right">Total</th>
                            ) : null}
                            {columns.includes("avg_duration_seconds") ? (
                              <th className="px-4 py-3 text-right">Avg duration</th>
                            ) : null}
                            {columns.includes("attendance_rate") ? (
                              <th className="px-4 py-3 text-right">Attendance %</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((session) => {
                            const checked = selectedIds.has(session.id);
                            const cancelled = session.status === "cancelled";
                            const rate = session.attendanceRate;
                            return (
                              <tr
                                key={session.id}
                                className="h-11 cursor-pointer border-t border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]"
                                onClick={() => {
                                  openSession(session);
                                }}
                              >
                                <td
                                  className="px-3 py-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                    checked={checked}
                                    aria-label={`Select ${session.title}`}
                                    onChange={() => {
                                      setSelectedIds((current) => {
                                        const next = new Set(current);
                                        if (next.has(session.id)) next.delete(session.id);
                                        else next.add(session.id);
                                        return next;
                                      });
                                    }}
                                  />
                                </td>
                                {columns.includes("title") ? (
                                  <td className="px-4 py-2 font-medium text-[var(--admin-on-surface)]">
                                    {session.title}
                                  </td>
                                ) : null}
                                {columns.includes("status") ? (
                                  <td className="px-4 py-2">
                                    <StatusPill tone={sessionStatusTone(session.status)}>
                                      {titleCase(session.status)}
                                    </StatusPill>
                                  </td>
                                ) : null}
                                {columns.includes("course_title") ? (
                                  <td className="px-4 py-2 text-[var(--admin-on-surface-variant)]">
                                    {session.courseTitle ?? "-"}
                                  </td>
                                ) : null}
                                {columns.includes("batch_name") ? (
                                  <td className="px-4 py-2 text-[var(--admin-on-surface-variant)]">
                                    {session.batchName ?? "-"}
                                  </td>
                                ) : null}
                                {columns.includes("scheduled_at") ? (
                                  <td className="px-4 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                    {formatDate(session.scheduledAt)}
                                  </td>
                                ) : null}
                                {columns.includes("started_at") ? (
                                  <td className="px-4 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                    {formatDate(session.startedAt)}
                                  </td>
                                ) : null}
                                {columns.includes("ended_at") ? (
                                  <td className="px-4 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                    {formatDate(session.endedAt)}
                                  </td>
                                ) : null}
                                {columns.includes("duration_seconds") ? (
                                  <td className="px-4 py-2 text-right font-mono">
                                    {cancelled ? "-" : formatDuration(session.durationSeconds)}
                                  </td>
                                ) : null}
                                {columns.includes("attended_count") ? (
                                  <td className="px-4 py-2 text-right font-mono">
                                    {cancelled ? "-" : formatCount(session.attendedCount)}
                                  </td>
                                ) : null}
                                {columns.includes("registered_count") ? (
                                  <td className="px-4 py-2 text-right font-mono">
                                    {formatCount(session.registeredCount)}
                                  </td>
                                ) : null}
                                {columns.includes("absent_count") ? (
                                  <td className="px-4 py-2 text-right font-mono">
                                    {cancelled ? "-" : formatCount(session.absentCount)}
                                  </td>
                                ) : null}
                                {columns.includes("total_count") ? (
                                  <td className="px-4 py-2 text-right font-mono">
                                    {formatCount(session.totalCount)}
                                  </td>
                                ) : null}
                                {columns.includes("avg_duration_seconds") ? (
                                  <td className="px-4 py-2 text-right font-mono">
                                    {cancelled ? "-" : formatDuration(session.avgDurationSeconds)}
                                  </td>
                                ) : null}
                                {columns.includes("attendance_rate") ? (
                                  <td className="px-4 py-2 text-right">
                                    {cancelled ? (
                                      <span className="font-mono text-[var(--admin-on-surface-variant)]">
                                        -
                                      </span>
                                    ) : (
                                      <div className="ml-auto flex w-28 flex-col items-end gap-1">
                                        <span
                                          className={[
                                            "font-mono",
                                            rate != null && rate < 40
                                              ? "text-[var(--admin-warning)]"
                                              : "text-[var(--admin-on-surface)]",
                                          ].join(" ")}
                                        >
                                          {formatRate(rate)}
                                        </span>
                                        <MetricBar
                                          pct={rate}
                                          tone={rate != null && rate < 40 ? "warning" : "success"}
                                        />
                                      </div>
                                    )}
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="flex h-10 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-xs text-[var(--admin-on-surface-variant)]">
                    <span>
                      Showing {formatCount(pageStart)}-{formatCount(pageEnd)} of{" "}
                      {formatCount(totalCount)} sessions
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                        disabled={page <= 1 || loading}
                        aria-label="Previous page"
                        onClick={() => {
                          setPage((current) => Math.max(1, current - 1));
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                        disabled={totalPages === 0 || page >= totalPages || loading}
                        aria-label="Next page"
                        onClick={() => {
                          setPage((current) => current + 1);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        ) : null}
      </>
    </div>
  );
}
