"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Inbox,
  Lock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { dropdownPanelEnterBottomClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ClientApiError } from "../../../lib/client-api";
import { fetchExportJob } from "../../data-rights/api";
import {
  EXPORTS_HISTORY_COLUMN_OPTIONS,
  EXPORTS_REPORT_DEFINITIONS,
  PII_DEFINITION_KEYS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportExportsHistoryReport,
  fetchExportsHistory,
  type ExportsFileState,
  type ExportsHistoryColumnKey,
  type ExportsHistoryItem,
  type ExportsHistorySummary,
} from "./admin-exports-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { BiExportPanel } from "./BiExportPanel";
import { CustomReportBuilder } from "./CustomReportBuilder";

type DatePreset = "7d" | "30d" | "90d" | "custom";
type SavedView = "all" | "failed" | "running" | "expiring" | "mine";
type ModuleTab = "history" | "new" | "schedules" | "destinations" | "settings";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const DEFAULT_COLUMNS: ExportsHistoryColumnKey[] = [
  "status",
  "created_at",
  "definition_title",
  "row_count",
  "format",
  "requested_by_name",
];

const EMPTY_SUMMARY: ExportsHistorySummary = {
  totalCount: 0,
  succeededCount: 0,
  failedCount: 0,
  pendingCount: 0,
  filesAvailableCount: 0,
  expiringSoonCount: 0,
  oldestPendingTitle: null,
};

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function presetToRange(preset: Exclude<DatePreset, "custom">): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: toDateInput(from), to: toDateInput(to) };
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatAbsolute(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    const ahead = Math.abs(diffMs);
    if (ahead < 60_000) return "in under a minute";
    const mins = Math.floor(ahead / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "RUNNING":
      return "Running";
    case "SUCCEEDED":
      return "Succeeded";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusPillClass(status: string): string {
  if (status === "SUCCEEDED") {
    return "border-[color-mix(in_srgb,var(--admin-success)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (status === "FAILED") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function sourceLabel(sourceType: ExportsHistoryItem["sourceType"]): string {
  return sourceType === "report_run" ? "Report run" : "Export job";
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  const ms = date.getTime() - Date.now();
  return ms > 0 && ms <= 48 * 60 * 60 * 1000;
}

function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-[var(--admin-surface-high)] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--admin-surface)_65%,transparent)] to-transparent motion-reduce:animate-none" />
    </div>
  );
}

function ExportsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading export history">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="relative col-span-1 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="mb-3 h-9 w-20" />
          <Shimmer className="h-3 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-2 h-3 w-20" />
            <Shimmer className="mb-3 h-7 w-14" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <div className="mb-4 flex gap-2">
          <Shimmer className="h-7 w-24 rounded-full" />
          <Shimmer className="h-7 w-20 rounded-full" />
          <Shimmer className="h-7 w-28 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Shimmer className="h-9 w-full max-w-xs" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-3 w-[12%]" />
          <Shimmer className="h-3 w-[14%]" />
          <Shimmer className="h-3 w-[28%]" />
          <Shimmer className="h-3 w-[10%]" />
          <Shimmer className="h-3 w-[10%]" />
          <Shimmer className="h-3 w-[14%]" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            style={{ animationDelay: `${String(index * 40)}ms` }}
          >
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-10" />
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusCell({ item }: { item: ExportsHistoryItem }) {
  if (item.status === "RUNNING") {
    const pct = item.progressPercent;
    return (
      <div className="flex min-w-[140px] items-center gap-2">
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] border-t-[var(--admin-primary-strong)] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary-strong)] transition-[width] duration-200 ease-out"
            style={{ width: pct == null ? "40%" : `${String(pct)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)]">
          {pct == null ? "…" : `${String(pct)}%`}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${statusPillClass(item.status)}`}
    >
      {statusLabel(item.status)}
    </span>
  );
}

function FileAffordance({
  item,
  downloading,
  onDownload,
}: {
  item: ExportsHistoryItem;
  downloading: boolean;
  onDownload: () => void;
}) {
  const detailHref = `/admin/reports/exports/${item.id}?source=${item.sourceType}`;

  if (item.status === "QUEUED" || item.status === "RUNNING") {
    return (
      <Link
        href={detailHref}
        className="text-sm font-medium text-[var(--admin-primary)] hover:text-[var(--admin-primary-strong)] hover:underline"
      >
        View run
      </Link>
    );
  }

  if (item.status === "FAILED") {
    const retryHref = item.definitionKey
      ? `/admin/reports/exports/new?definition=${encodeURIComponent(item.definitionKey)}`
      : "/admin/reports/exports/new";
    return (
      <div className="flex items-center justify-end gap-3">
        <Link
          href={detailHref}
          className="text-sm font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)] hover:underline"
        >
          Details
        </Link>
        <Link
          href={retryHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Link>
      </div>
    );
  }

  if (item.status === "SUCCEEDED" && item.canDownload) {
    return (
      <div className="flex items-center justify-end gap-3">
        <Link
          href={detailHref}
          className="text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] hover:underline"
        >
          Details
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)] disabled:opacity-50"
          disabled={downloading}
          onClick={onDownload}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {downloading ? "Opening…" : "Download"}
        </button>
      </div>
    );
  }

  if (item.status === "SUCCEEDED" && item.hasFile && !item.canDownload) {
    return (
      <span
        className="inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)]"
        title="Only the requester and owners can download this file"
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Restricted
      </span>
    );
  }

  if (item.status === "SUCCEEDED" && !item.hasFile) {
    const rerunHref = item.definitionKey
      ? `/admin/reports/exports/new?definition=${encodeURIComponent(item.definitionKey)}`
      : "/admin/reports/exports/new";
    return (
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-[var(--admin-on-surface-variant)]">
          Removed{item.expiresAt ? ` ${formatAbsolute(item.expiresAt).slice(0, 10)}` : ""}
        </span>
        <Link
          href={rerunHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Re-run
        </Link>
      </div>
    );
  }

  return <span className="text-sm text-[var(--admin-on-surface-variant)]">-</span>;
}

export function AdminExportsRosterPage() {
  const datePresetLabelId = useId();
  const sourceLabelId = useId();
  const statusLabelId = useId();
  const reportLabelId = useId();
  const formatLabelId = useId();
  const fileLabelId = useId();
  const builderRef = useRef<HTMLDivElement>(null);
  const columnsAnchorRef = useRef<HTMLButtonElement>(null);
  const columnsPanelRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ExportsHistoryItem[]>([]);
  const [summary, setSummary] = useState<ExportsHistorySummary>(EMPTY_SUMMARY);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const initialRange = presetToRange("30d");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [createdFrom, setCreatedFrom] = useState(initialRange.from);
  const [createdTo, setCreatedTo] = useState(initialRange.to);
  const [savedView, setSavedView] = useState<SavedView>("all");

  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [definitionKey, setDefinitionKey] = useState("");
  const [format, setFormat] = useState("");
  const [fileState, setFileState] = useState<ExportsFileState | "">("");
  const [mine, setMine] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [columns, setColumns] = useState<ExportsHistoryColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<ExportsHistoryColumnKey[]>(DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(searchQ.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQ]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (columnsPanelRef.current?.contains(target)) return;
      if (columnsAnchorRef.current?.contains(target)) return;
      setColumnsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen]);

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
    setDateMenuOpen(false);
    if (preset === "custom") return;
    const range = presetToRange(preset);
    setCreatedFrom(range.from);
    setCreatedTo(range.to);
    setPage(1);
  }, []);

  const applySavedView = useCallback((view: SavedView) => {
    setSavedView(view);
    setPage(1);
    setSelectedIds(new Set());
    if (view === "all") {
      setStatus("");
      setFileState("");
      setMine(false);
      setPendingOnly(false);
      return;
    }
    if (view === "failed") {
      setStatus("FAILED");
      setFileState("");
      setMine(false);
      setPendingOnly(false);
      return;
    }
    if (view === "running") {
      setStatus("");
      setFileState("");
      setMine(false);
      setPendingOnly(true);
      return;
    }
    if (view === "expiring") {
      setStatus("");
      setFileState("expiring_soon");
      setMine(false);
      setPendingOnly(false);
      return;
    }
    setStatus("");
    setFileState("");
    setMine(true);
    setPendingOnly(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = dateInputToStartIso(createdFrom);
      const to = dateInputToEndIso(createdTo);
      const response = await fetchExportsHistory({
        ...(debouncedQ ? { q: debouncedQ } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(status ? { status } : {}),
        ...(definitionKey ? { definitionKey } : {}),
        ...(format ? { format } : {}),
        ...(fileState ? { fileState } : {}),
        ...(mine ? { mine: true } : {}),
        ...(pendingOnly ? { pendingOnly: true } : {}),
        ...(from ? { createdFrom: from } : {}),
        ...(to ? { createdTo: to } : {}),
        columns,
        page,
        limit: pageSize,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
      setPageSize(response.data.pageInfo.pageSize);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load export history.",
      );
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setTotalPages(0);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    columns,
    createdFrom,
    createdTo,
    debouncedQ,
    definitionKey,
    fileState,
    format,
    mine,
    page,
    pageSize,
    pendingOnly,
    sourceType,
    status,
  ]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) return current;
      const visible = new Set(items.map((item) => item.id));
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const show = useCallback((key: ExportsHistoryColumnKey) => columns.includes(key), [columns]);

  const successRate =
    summary.totalCount > 0
      ? ((summary.succeededCount / summary.totalCount) * 100).toFixed(1)
      : null;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const selectedWithFiles = selectedItems.filter((item) => item.canDownload).length;

  const appliedChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (sourceType) {
      chips.push({
        key: "source",
        label: sourceType === "report_run" ? "Source: Report run" : "Source: Export job",
        clear: () => {
          setSourceType("");
          setPage(1);
        },
      });
    }
    if (status) {
      chips.push({
        key: "status",
        label: `Status: ${statusLabel(status)}`,
        clear: () => {
          setStatus("");
          setSavedView("all");
          setPage(1);
        },
      });
    }
    if (definitionKey) {
      const report = EXPORTS_REPORT_DEFINITIONS.find((entry) => entry.key === definitionKey);
      chips.push({
        key: "report",
        label: `Report: ${report?.title ?? definitionKey}`,
        clear: () => {
          setDefinitionKey("");
          setPage(1);
        },
      });
    }
    if (format) {
      chips.push({
        key: "format",
        label: `Format: ${format.toUpperCase()}`,
        clear: () => {
          setFormat("");
          setPage(1);
        },
      });
    }
    if (fileState) {
      const labels: Record<ExportsFileState, string> = {
        available: "File: Available",
        removed: "File: Removed",
        expired: "File: Expired",
        expiring_soon: "File: Expiring soon",
      };
      chips.push({
        key: "file",
        label: labels[fileState],
        clear: () => {
          setFileState("");
          setSavedView("all");
          setPage(1);
        },
      });
    }
    if (mine) {
      chips.push({
        key: "mine",
        label: "My exports",
        clear: () => {
          setMine(false);
          setSavedView("all");
          setPage(1);
        },
      });
    }
    if (pendingOnly) {
      chips.push({
        key: "pending",
        label: "Queued / Running",
        clear: () => {
          setPendingOnly(false);
          setSavedView("all");
          setPage(1);
        },
      });
    }
    if (debouncedQ) {
      chips.push({
        key: "q",
        label: `Search: ${debouncedQ}`,
        clear: () => {
          setSearchQ("");
          setPage(1);
        },
      });
    }
    return chips;
  }, [debouncedQ, definitionKey, fileState, format, mine, pendingOnly, sourceType, status]);

  function clearAllFilters() {
    setSearchQ("");
    setSourceType("");
    setStatus("");
    setDefinitionKey("");
    setFormat("");
    setFileState("");
    setMine(false);
    setPendingOnly(false);
    setSavedView("all");
    setPage(1);
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const downloadable = items.filter((item) => item.canDownload || item.status !== "SUCCEEDED");
    if (downloadable.length === 0) return;
    const allSelected = downloadable.every((item) => selectedIds.has(item.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const item of downloadable) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  async function handleDownload(item: ExportsHistoryItem) {
    if (!item.canDownload) return;
    setDownloadingId(item.id);
    setError(null);
    try {
      if (item.sourceType === "report_run") {
        const downloadFormat =
          item.format === "xlsx" || item.format === "pdf" || item.format === "csv"
            ? item.format
            : "csv";
        await downloadReportExport(item.id, downloadFormat);
      } else {
        const detail = await fetchExportJob(item.id);
        const url = detail.data.download?.url;
        if (!url) {
          throw new Error("Download link is not available for this export.");
        }
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (downloadError) {
      setError(
        downloadError instanceof ClientApiError
          ? downloadError.message
          : downloadError instanceof Error
            ? downloadError.message
            : "Unable to download file.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadSelected() {
    const targets = selectedItems.filter((item) => item.canDownload);
    for (const item of targets) {
      await handleDownload(item);
    }
  }

  async function handleExportHistory() {
    setBusy(true);
    setError(null);
    try {
      const from = dateInputToStartIso(createdFrom);
      const to = dateInputToEndIso(createdTo);
      const response = await exportExportsHistoryReport({
        ...(debouncedQ ? { q: debouncedQ } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(status ? { status } : {}),
        ...(definitionKey ? { definitionKey } : {}),
        ...(format ? { format } : {}),
        ...(fileState ? { fileState } : {}),
        ...(mine ? { mine: true } : {}),
        ...(pendingOnly ? { pendingOnly: true } : {}),
        ...(from ? { createdFrom: from } : {}),
        ...(to ? { createdTo: to } : {}),
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
      void loadHistory();
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export history.",
      );
    } finally {
      setBusy(false);
    }
  }

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const moduleTabs: Array<{ key: ModuleTab; label: string; enabled: boolean; href?: string }> = [
    { key: "history", label: "History", enabled: true },
    { key: "new", label: "New export", enabled: true, href: "/admin/reports/exports/new" },
    {
      key: "schedules",
      label: "Schedules",
      enabled: true,
      href: "/admin/reports/exports/schedules",
    },
    {
      key: "destinations",
      label: "Destinations",
      enabled: true,
      href: "/admin/reports/exports/destinations",
    },
    { key: "settings", label: "Settings", enabled: true, href: "/admin/reports/exports/settings" },
  ];

  const savedViews: Array<{ key: SavedView; label: string }> = [
    { key: "all", label: "All exports" },
    { key: "failed", label: "Failed" },
    { key: "running", label: "Running now" },
    { key: "expiring", label: "Expiring soon" },
    { key: "mine", label: "My exports" },
  ];

  return (
    <div className="relative flex flex-col gap-6 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-medium tracking-wide text-[var(--admin-on-surface-variant)]">
            Admin / Reports / Exports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Every data extraction across all reports - what was pulled, by whom, and whether the
            file still exists.
          </p>
          <nav
            className="mt-4 flex items-end gap-5 border-b border-[var(--admin-border)]"
            aria-label="Exports module"
          >
            {moduleTabs.map((tab) => {
              const className = `-mb-px border-b-2 pb-2 text-sm transition-colors ${
                tab.key === "history"
                  ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
                  : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-50"
              }`;
              if (tab.href) {
                return (
                  <Link key={tab.key} href={tab.href} className={className}>
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={!tab.enabled}
                  title={tab.enabled ? undefined : "Coming soon"}
                  className={className}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
                </span>
              }
              panelAriaLabel="Date range options"
            >
              <div className="p-1.5" role="listbox">
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["90d", "Last 90 days"],
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
                    }}
                  >
                    {label}
                    {datePreset === value ? (
                      <Check className="ml-auto h-4 w-4" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <div className="relative">
            <button
              ref={columnsAnchorRef}
              type="button"
              className={secondaryButtonClassName}
              aria-haspopup="dialog"
              aria-expanded={columnsOpen}
              onClick={() => {
                setDraftColumns(columns);
                setColumnsOpen((open) => !open);
              }}
            >
              <Columns3
                className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              Columns
              <ChevronDown
                className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${
                  columnsOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            {columnsOpen ? (
              <div
                ref={columnsPanelRef}
                role="dialog"
                aria-label="Visible columns"
                className={`absolute right-0 top-[calc(100%+8px)] z-30 flex w-64 max-h-[80vh] flex-col overflow-hidden bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`}
              >
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Visible columns
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                  {EXPORTS_HISTORY_COLUMN_OPTIONS.map((option) => {
                    const checked = draftColumns.includes(option.key);
                    return (
                      <label
                        key={option.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--admin-surface-low)] ${
                          checked
                            ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                            : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          checked={checked}
                          onChange={() => {
                            setDraftColumns((current) => {
                              if (current.includes(option.key)) {
                                if (current.length === 1) return current;
                                return current.filter((column) => column !== option.key);
                              }
                              return [...current, option.key];
                            });
                          }}
                        />
                        <span className="text-sm text-[var(--admin-on-surface)]">
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[var(--admin-border)] px-3 py-2">
                  <button
                    type="button"
                    className="text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                    onClick={() => {
                      setDraftColumns(DEFAULT_COLUMNS);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
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

          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExportHistory()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy ? "Exporting…" : "Export this list"}
          </button>
          <Link href="/admin/reports/exports/new" className={primaryButtonClassName}>
            New export
          </Link>
        </div>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
          role="alert"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--admin-danger)]">
              Couldn&apos;t load export history.
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] active:translate-y-px"
            onClick={() => void loadHistory()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 && !error ? (
        <ExportsLoadingSkeleton />
      ) : !loading && items.length === 0 && !error && appliedChips.length === 0 && !debouncedQ ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {(
              [
                ["Total exports", "0"],
                ["Succeeded", "0"],
                ["Success rate", "-"],
                ["Files available", "0"],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
              >
                <p className="text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                  {label}
                </p>
                <p className="mt-1 font-mono text-[28px] font-semibold text-[var(--admin-on-surface)]">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <section className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-surface-low)]">
              <Inbox
                className="h-9 w-9 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <div className="absolute -right-1 -bottom-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
                <ArrowDown className="h-3.5 w-3.5 text-[var(--admin-primary)]" aria-hidden="true" />
              </div>
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No exports in this range
            </h2>
            <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Exports you run from any report appear here. Try adjusting your filters or run a new
              export to get started.
            </p>
            <Link href="/admin/reports/exports/new" className={primaryButtonClassName}>
              New export
            </Link>
          </section>
        </>
      ) : !error ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-primary-strong)]" />
              <div>
                <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                  Total exports
                </p>
                <div className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                  {formatCount(summary.totalCount)}
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                in {datePresetLabel.toLowerCase()}
              </p>
            </div>

            <button
              type="button"
              className="col-span-1 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--admin-success)_50%,var(--admin-border))] active:translate-y-px"
              onClick={() => {
                applySavedView("all");
              }}
            >
              <div>
                <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                  Succeeded
                </p>
                <div className="font-mono text-2xl font-medium text-[var(--admin-success)]">
                  {formatCount(summary.succeededCount)}
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                {successRate == null ? "No runs yet" : `${successRate}% success rate`}
              </p>
            </button>

            <button
              type="button"
              className="col-span-1 flex flex-col justify-between rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] active:translate-y-px"
              onClick={() => {
                applySavedView("failed");
              }}
            >
              <div>
                <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-danger)] uppercase">
                  Failed
                </p>
                <div className="font-mono text-2xl font-medium text-[var(--admin-danger)]">
                  {formatCount(summary.failedCount)}
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface-variant))]">
                {summary.failedCount > 0 ? "Needs review" : "None in range"}
              </p>
            </button>

            <button
              type="button"
              className="col-span-1 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--admin-warning)_50%,var(--admin-border))] active:translate-y-px"
              onClick={() => {
                applySavedView("running");
              }}
            >
              <div>
                <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                  Queued / Running
                </p>
                <div className="font-mono text-2xl font-medium text-[var(--admin-warning)]">
                  {formatCount(summary.pendingCount)}
                </div>
              </div>
              <p
                className="mt-2 truncate text-[12px] text-[var(--admin-on-surface-variant)]"
                title={summary.oldestPendingTitle ?? undefined}
              >
                {summary.oldestPendingTitle
                  ? `Oldest: ${summary.oldestPendingTitle}`
                  : "Queue is clear"}
              </p>
            </button>

            <button
              type="button"
              className="col-span-1 flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--admin-warning)_50%,var(--admin-border))] active:translate-y-px"
              onClick={() => {
                applySavedView("expiring");
              }}
            >
              <div>
                <p className="mb-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                  Files available
                </p>
                <div className="font-mono text-2xl font-medium text-[var(--admin-on-surface)]">
                  {formatCount(summary.filesAvailableCount)}
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[var(--admin-warning)]">
                {formatCount(summary.expiringSoonCount)} expiring in &lt; 48h
              </p>
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[12px] tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                Views:
              </span>
              {savedViews.map((view) => {
                const active = savedView === view.key;
                return (
                  <button
                    key={view.key}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      active
                        ? "border-[var(--admin-primary)] bg-[var(--admin-surface)] font-medium text-[var(--admin-primary)]"
                        : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface)]"
                    }`}
                    onClick={() => {
                      applySavedView(view.key);
                    }}
                  >
                    {view.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-[200px] flex-1 gap-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                Search
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    className={`${fieldClassName} pl-9`}
                    value={searchQ}
                    onChange={(event) => {
                      setSearchQ(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search file name, report, or requester"
                  />
                </div>
              </label>

              <div className="min-w-[140px]">
                <DropdownField
                  label={
                    <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Source
                    </span>
                  }
                  labelId={sourceLabelId}
                  open={sourceOpen}
                  onToggle={() => {
                    setSourceOpen((open) => !open);
                  }}
                  triggerContent={
                    <span>
                      {sourceType === "report_run"
                        ? "Report run"
                        : sourceType === "export_job"
                          ? "Export job"
                          : "All"}
                    </span>
                  }
                  panelAriaLabel="Source filter"
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["", "All"],
                        ["report_run", "Report run"],
                        ["export_job", "Export job"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        role="option"
                        className={dropdownItemClassName}
                        onClick={() => {
                          setSourceType(value);
                          setSourceOpen(false);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>

              <div className="min-w-[140px]">
                <DropdownField
                  label={
                    <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Status
                    </span>
                  }
                  labelId={statusLabelId}
                  open={statusOpen}
                  onToggle={() => {
                    setStatusOpen((open) => !open);
                  }}
                  triggerContent={
                    <span>
                      {pendingOnly ? "Queued / Running" : status ? statusLabel(status) : "All"}
                    </span>
                  }
                  panelAriaLabel="Status filter"
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["", "All"],
                        ["QUEUED", "Queued"],
                        ["RUNNING", "Running"],
                        ["SUCCEEDED", "Succeeded"],
                        ["FAILED", "Failed"],
                        ["CANCELLED", "Cancelled"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        role="option"
                        className={dropdownItemClassName}
                        onClick={() => {
                          setStatus(value);
                          setPendingOnly(false);
                          setSavedView(value === "FAILED" ? "failed" : "all");
                          setStatusOpen(false);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>

              <div className="min-w-[200px]">
                <DropdownField
                  label={
                    <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Report
                    </span>
                  }
                  labelId={reportLabelId}
                  open={reportOpen}
                  onToggle={() => {
                    setReportOpen((open) => !open);
                  }}
                  triggerContent={
                    <span className="truncate">
                      {definitionKey
                        ? (EXPORTS_REPORT_DEFINITIONS.find((entry) => entry.key === definitionKey)
                            ?.title ?? definitionKey)
                        : `Any (${EXPORTS_REPORT_DEFINITIONS.length} keys)`}
                    </span>
                  }
                  panelAriaLabel="Report filter"
                >
                  <div className="max-h-72 overflow-y-auto p-1.5" role="listbox">
                    <button
                      type="button"
                      role="option"
                      className={dropdownItemClassName}
                      onClick={() => {
                        setDefinitionKey("");
                        setReportOpen(false);
                        setPage(1);
                      }}
                    >
                      Any report
                    </button>
                    {EXPORTS_REPORT_DEFINITIONS.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        role="option"
                        className={dropdownItemClassName}
                        onClick={() => {
                          setDefinitionKey(entry.key);
                          setReportOpen(false);
                          setPage(1);
                        }}
                      >
                        <span className="flex min-w-0 flex-col items-start">
                          <span>{entry.title}</span>
                          <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {entry.key}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>

              <div className="min-w-[140px]">
                <DropdownField
                  label={
                    <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                      Format
                    </span>
                  }
                  labelId={formatLabelId}
                  open={formatOpen}
                  onToggle={() => {
                    setFormatOpen((open) => !open);
                  }}
                  triggerContent={<span>{format ? format.toUpperCase() : "All formats"}</span>}
                  panelAriaLabel="Format filter"
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["", "All formats"],
                        ["csv", "CSV"],
                        ["xlsx", "XLSX"],
                        ["pdf", "PDF"],
                        ["json", "JSON"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        role="option"
                        className={dropdownItemClassName}
                        onClick={() => {
                          setFormat(value);
                          setFormatOpen(false);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>

              <div className="min-w-[140px]">
                <DropdownField
                  label={
                    <span className="text-[12px] text-[var(--admin-on-surface-variant)]">File</span>
                  }
                  labelId={fileLabelId}
                  open={fileOpen}
                  onToggle={() => {
                    setFileOpen((open) => !open);
                  }}
                  triggerContent={
                    <span>
                      {fileState === "available"
                        ? "Available"
                        : fileState === "removed"
                          ? "Removed"
                          : fileState === "expired"
                            ? "Expired"
                            : fileState === "expiring_soon"
                              ? "Expiring soon"
                              : "Any"}
                    </span>
                  }
                  panelAriaLabel="File filter"
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["", "Any"],
                        ["available", "Available"],
                        ["removed", "Removed"],
                        ["expired", "Expired"],
                        ["expiring_soon", "Expiring soon"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        role="option"
                        className={dropdownItemClassName}
                        onClick={() => {
                          setFileState(value);
                          setSavedView(value === "expiring_soon" ? "expiring" : "all");
                          setFileOpen(false);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>
            </div>

            {appliedChips.length > 0 ? (
              <div className={`flex flex-wrap items-center gap-2 ${inlineExpandClassName}`}>
                {appliedChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                    onClick={chip.clear}
                  >
                    {chip.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {items.length === 0 ? (
            <section className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
              <Inbox
                className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No exports match these filters
              </h2>
              <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                Try clearing filters or widening the date range.
              </p>
              <button type="button" className={secondaryButtonClassName} onClick={clearAllFilters}>
                Clear all filters
              </button>
            </section>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          aria-label="Select all visible exports"
                        />
                      </th>
                      {show("status") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Status
                        </th>
                      ) : null}
                      {show("created_at") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          <span className="inline-flex items-center gap-1">
                            Created
                            <ArrowDown
                              className="h-4 w-4 text-[var(--admin-primary)]"
                              aria-hidden="true"
                            />
                          </span>
                        </th>
                      ) : null}
                      {show("source_type") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Source
                        </th>
                      ) : null}
                      {show("definition_title") || show("definition_key") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Report / Details
                        </th>
                      ) : null}
                      {show("row_count") ? (
                        <th className="px-4 py-3 text-right text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Rows
                        </th>
                      ) : null}
                      {show("format") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Format
                        </th>
                      ) : null}
                      {show("requested_by_name") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Requested by
                        </th>
                      ) : null}
                      {show("completed_at") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Completed
                        </th>
                      ) : null}
                      {show("expires_at") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Expires
                        </th>
                      ) : null}
                      {show("has_file") ? (
                        <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Has file
                        </th>
                      ) : null}
                      <th className="px-4 py-3 text-right text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {items.map((item) => {
                      const selected = selectedIds.has(item.id);
                      const failed = item.status === "FAILED";
                      const containsPii =
                        item.definitionKey != null && PII_DEFINITION_KEYS.has(item.definitionKey);
                      const expired = isExpired(item.expiresAt);
                      const expiringSoon = isExpiringSoon(item.expiresAt);

                      return (
                        <tr
                          key={`${item.sourceType}-${item.id}`}
                          className={`group h-11 transition-colors hover:bg-[var(--admin-surface-high)] ${
                            selected
                              ? "relative bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                              : failed
                                ? "bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]"
                                : ""
                          }`}
                        >
                          <td className="relative px-4 py-2 text-center">
                            {selected ? (
                              <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-[var(--admin-primary-strong)]" />
                            ) : null}
                            <input
                              type="checkbox"
                              className={`h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] transition-opacity focus:ring-[var(--admin-primary)] ${
                                selected ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                              }`}
                              checked={selected}
                              onChange={() => {
                                toggleRow(item.id);
                              }}
                              aria-label={`Select export ${item.definitionTitle ?? item.id}`}
                            />
                          </td>
                          {show("status") ? (
                            <td className="px-4 py-2">
                              <StatusCell item={item} />
                            </td>
                          ) : null}
                          {show("created_at") ? (
                            <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                              <div>{formatRelative(item.createdAt)}</div>
                              <div className="text-[11px] text-[var(--admin-on-surface-variant)]">
                                {formatAbsolute(item.createdAt)}
                              </div>
                            </td>
                          ) : null}
                          {show("source_type") ? (
                            <td className="px-4 py-2">
                              <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                                {sourceLabel(item.sourceType)}
                              </span>
                            </td>
                          ) : null}
                          {show("definition_title") || show("definition_key") ? (
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {show("definition_title") ? (
                                    <Link
                                      href={`/admin/reports/exports/${item.id}?source=${item.sourceType}`}
                                      className="text-sm font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary-strong)] hover:underline"
                                    >
                                      {item.definitionTitle ?? "Definition no longer available"}
                                    </Link>
                                  ) : null}
                                  {show("definition_key") && item.definitionKey ? (
                                    <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                      {item.definitionKey}
                                    </span>
                                  ) : null}
                                  {containsPii ? (
                                    <span className="inline-flex items-center gap-0.5 rounded border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--admin-danger)] uppercase">
                                      PII
                                    </span>
                                  ) : null}
                                </div>
                                {failed && item.errorMessage ? (
                                  <span
                                    className="max-w-[240px] truncate font-mono text-xs text-[var(--admin-danger)]"
                                    title={item.errorMessage}
                                  >
                                    {item.errorMessage}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                          {show("row_count") ? (
                            <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {item.rowCount == null ? "-" : formatCount(item.rowCount)}
                            </td>
                          ) : null}
                          {show("format") ? (
                            <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                              {item.format?.toUpperCase() ?? "-"}
                            </td>
                          ) : null}
                          {show("requested_by_name") ? (
                            <td className="px-4 py-2 text-sm text-[var(--admin-on-surface)]">
                              {item.requestedByName ?? "-"}
                            </td>
                          ) : null}
                          {show("completed_at") ? (
                            <td className="px-4 py-2 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                              {formatAbsolute(item.completedAt)}
                            </td>
                          ) : null}
                          {show("expires_at") ? (
                            <td
                              className={`px-4 py-2 font-mono text-[13px] ${
                                expired
                                  ? "text-[var(--admin-on-surface-variant)]"
                                  : expiringSoon
                                    ? "text-[var(--admin-warning)]"
                                    : "text-[var(--admin-on-surface)]"
                              }`}
                            >
                              {expired ? "Expired" : formatAbsolute(item.expiresAt)}
                            </td>
                          ) : null}
                          {show("has_file") ? (
                            <td className="px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                              {item.hasFile ? "Yes" : "No"}
                            </td>
                          ) : null}
                          <td className="px-4 py-2 text-right">
                            <FileAffordance
                              item={item}
                              downloading={downloadingId === item.id}
                              onDownload={() => void handleDownload(item)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  Showing {formatCount(showingFrom)}-{formatCount(showingTo)} of{" "}
                  {formatCount(totalCount)} exports
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1));
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <span className="px-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                    {totalPages === 0 ? "0 / 0" : `${page} / ${totalPages}`}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] disabled:opacity-50"
                    disabled={page >= totalPages || totalPages === 0}
                    onClick={() => {
                      setPage((current) => current + 1);
                    }}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
            Run records are kept for audit even after their files are removed. All export actions
            are logged with PII masking.
          </p>
        </>
      ) : null}

      {selectedIds.size > 0 ? (
        <div
          className={`fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3 text-[var(--admin-on-surface)] shadow-xl ${dropdownPanelEnterBottomClassName}`}
        >
          <div className="flex flex-wrap items-center gap-2 border-[var(--admin-border)] pr-0 sm:border-r sm:pr-4">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--admin-primary-strong)] font-mono text-sm font-bold text-[var(--admin-on-primary)]">
              {selectedIds.size}
            </span>
            <span className="text-sm">exports selected</span>
            <span className="text-[var(--admin-on-surface-variant)]">·</span>
            <span className="text-sm text-[var(--admin-on-surface-variant)]">
              {selectedWithFiles} with files
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] disabled:opacity-50"
              disabled={selectedWithFiles === 0}
              onClick={() => void handleDownloadSelected()}
            >
              <Download className="h-[18px] w-[18px]" aria-hidden="true" />
              Download selected
            </button>
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setSelectedIds(new Set());
              }}
              aria-label="Clear selection"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <div ref={builderRef} className="scroll-mt-8 space-y-6">
        <CustomReportBuilder onRunStarted={() => void loadHistory()} />
        <BiExportPanel />
      </div>
    </div>
  );
}
