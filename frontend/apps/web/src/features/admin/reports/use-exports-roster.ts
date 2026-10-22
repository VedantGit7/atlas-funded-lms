"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import { fetchExportJob } from "../../data-rights/api";
import {
  EXPORTS_HISTORY_DEFAULTS,
  EXPORTS_REPORT_DEFINITIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportExportsHistoryReport,
  exportsHistoryPresetRange,
  fetchExportsHistory,
  type ExportsFileState,
  type ExportsHistoryColumnKey,
  type ExportsHistoryItem,
  type ExportsHistorySummary,
} from "./admin-exports-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale } from "./viewer-time";
import {
  DEFAULT_COLUMNS,
  type DatePreset,
  EMPTY_SUMMARY,
  type ExportsRosterProps,
  type ModuleTab,
  type SavedView,
  statusLabel,
} from "./admin-exports-roster-shared";

/** The state, data loading and handlers behind ExportsRoster. */
export function useExportsRoster(props: ExportsRosterProps) {
  const { initialHistory } = props;
  const viewer = useViewerLocale();
  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => initialHistory ?? null);
  const datePresetLabelId = useId();
  const sourceLabelId = useId();
  const statusLabelId = useId();
  const reportLabelId = useId();
  const formatLabelId = useId();
  const fileLabelId = useId();
  const builderRef = useRef<HTMLDivElement>(null);
  const columnsAnchorRef = useRef<HTMLButtonElement>(null);
  const columnsPanelRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(initial === null);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ExportsHistoryItem[]>(initial?.data.items ?? []);
  const [summary, setSummary] = useState<ExportsHistorySummary>(
    initial?.data.summary ?? EMPTY_SUMMARY,
  );
  const [page, setPage] = useState<number>(EXPORTS_HISTORY_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initial?.data.pageInfo.totalCount ?? 0);
  const [pageSize, setPageSize] = useState<number>(
    initial?.data.pageInfo.pageSize ?? EXPORTS_HISTORY_DEFAULTS.limit,
  );

  // The server's range when it loaded the history, so both render the same
  // dates even if the clocks disagree or the day turned in between.
  const [initialRange] = useState(
    () => initial?.range ?? exportsHistoryPresetRange(EXPORTS_HISTORY_DEFAULTS.datePreset),
  );
  const [datePreset, setDatePreset] = useState<DatePreset>(EXPORTS_HISTORY_DEFAULTS.datePreset);
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
    const range = exportsHistoryPresetRange(preset);
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

  const loadHistory = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
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
    },
    [
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
    ],
  );

  useReportLoad(loadHistory, initial);

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

  return {
    viewer,
    datePresetLabelId,
    sourceLabelId,
    statusLabelId,
    reportLabelId,
    formatLabelId,
    fileLabelId,
    builderRef,
    columnsAnchorRef,
    columnsPanelRef,
    loading,
    busy,
    downloadingId,
    error,
    items,
    summary,
    page,
    setPage,
    totalPages,
    totalCount,
    datePreset,
    dateMenuOpen,
    setDateMenuOpen,
    savedView,
    setSavedView,
    searchQ,
    setSearchQ,
    debouncedQ,
    sourceType,
    setSourceType,
    status,
    setStatus,
    definitionKey,
    setDefinitionKey,
    format,
    setFormat,
    fileState,
    setFileState,
    pendingOnly,
    setPendingOnly,
    sourceOpen,
    setSourceOpen,
    statusOpen,
    setStatusOpen,
    reportOpen,
    setReportOpen,
    formatOpen,
    setFormatOpen,
    fileOpen,
    setFileOpen,
    columnsOpen,
    setColumnsOpen,
    columns,
    setColumns,
    draftColumns,
    setDraftColumns,
    selectedIds,
    setSelectedIds,
    datePresetLabel,
    applyDatePreset,
    applySavedView,
    loadHistory,
    show,
    successRate,
    selectedWithFiles,
    appliedChips,
    clearAllFilters,
    toggleRow,
    toggleAllVisible,
    handleDownload,
    handleDownloadSelected,
    handleExportHistory,
    showingFrom,
    showingTo,
    allVisibleSelected,
    moduleTabs,
    savedViews,
  };
}

export type ExportsRosterView = ReturnType<typeof useExportsRoster>;
