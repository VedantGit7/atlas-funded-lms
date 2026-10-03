"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  deleteBatchExportSchedule,
  downloadBatchExport,
  fetchBatchExportRun,
  fetchBatchesExports,
  retryBatchExport,
  updateBatchExportSchedule,
  type BatchExportDataset,
  type BatchExportHistoryItem,
  type BatchExportScheduleItem,
  type BatchesExportsPayload,
} from "./admin-batches-exports-api";
import { BatchesNewExportDrawer } from "./BatchesNewExportDrawer";

type ModuleTab = "batches" | "compare" | "exports";

const MODULE_TABS: Array<{ key: ModuleTab; label: string; href: string }> = [
  { key: "batches", label: "Batches", href: "/admin/reports/batches" },
  { key: "compare", label: "Compare", href: "/admin/reports/batches/compare" },
  { key: "exports", label: "Exports", href: "/admin/reports/batches/exports" },
];

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}

function datasetChipClassName(dataset: BatchExportDataset): string {
  if (dataset === "batch_summary") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  if (dataset === "batch_learners") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (dataset === "live_attendance") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (dataset === "exams") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface-high))] text-[var(--admin-on-surface)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function healthRailClassName(item: BatchExportHistoryItem): string | null {
  if (item.status === "SUCCEEDED" && !item.expired) {
    return "bg-[var(--admin-success)]";
  }
  if (item.status === "FAILED") {
    return "bg-[var(--admin-danger)]";
  }
  return null;
}

function PolicyToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50 ${
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function DeterminateProgressBar({ percent }: { percent: number | null }) {
  const value = percent == null ? null : Math.min(100, Math.max(0, percent));
  if (value == null) {
    return (
      <div
        className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]"
        role="progressbar"
        aria-valuetext="Building export"
      >
        <div className="h-full w-full animate-pulse bg-[var(--admin-primary)]" />
      </div>
    );
  }
  return (
    <div
      className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-[var(--admin-surface-high)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Export ${value}% complete`}
    >
      <div
        className="h-full bg-[var(--admin-primary)] transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function FailureDrawer({
  item,
  onClose,
  onRetry,
  busy,
}: {
  item: BatchExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="flex items-start gap-4 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export failed
            </h2>
            <p className="mt-1 truncate font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              {item.fileName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Error reason
            </p>
            <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-[13px] break-words text-[var(--admin-on-surface)]">
              {item.errorMessage ?? item.errorCode ?? "Unknown export failure."}
            </div>
          </div>

          {item.errorTrace && item.errorTrace.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Execution trace
              </p>
              <pre className="max-h-56 overflow-auto rounded-sm border border-[var(--admin-border)] bg-[var(--admin-code-bg)] p-4 font-mono text-[11px] leading-relaxed text-[var(--admin-code-fg)]">
                {item.errorTrace.join("\n")}
              </pre>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Configuration
            </p>
            <dl className="space-y-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Dataset</dt>
                <dd className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.datasetLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Scope</dt>
                <dd className="max-w-[200px] truncate text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.scopeLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Format</dt>
                <dd className="font-mono text-[13px] uppercase text-[var(--admin-on-surface)]">
                  {item.format}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--admin-on-surface-variant)]">Requested by</dt>
                <dd className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {item.requestedByLabel || "-"}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[var(--admin-on-surface-variant)]">Columns</dt>
                <dd className="font-mono text-[12px] leading-relaxed break-words text-[var(--admin-on-surface)]">
                  {item.columns.length > 0 ? item.columns.join(", ") : "-"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Close
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Retry export
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportsSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="h-8 w-56 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8" />
        <div className="h-80 animate-pulse rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-4" />
      </div>
    </div>
  );
}

function BatchesReportTabs({ active }: { active: ModuleTab }) {
  return (
    <div className="border-b border-[var(--admin-border)]">
      <div className="flex gap-1" role="tablist" aria-label="Batches module">
        {MODULE_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active === tab.key}
            className={[
              "h-10 px-4 text-xs font-semibold tracking-[0.06em] uppercase transition-colors",
              active === tab.key
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminBatchesExportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BatchesExportsPayload | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSchedulePreset, setDrawerSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<BatchExportHistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<BatchExportHistoryItem | null>(null);
  const statusRef = useRef<Map<string, BatchExportHistoryItem["status"]>>(new Map());

  const applyPayload = useCallback((next: BatchesExportsPayload) => {
    setPayload(next);
    for (const item of next.history) {
      if (!statusRef.current.has(item.id)) {
        statusRef.current.set(item.id, item.status);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBatchesExports();
      applyPayload(response.data);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not load exports.");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildingIds = useMemo(
    () =>
      (payload?.history ?? [])
        .filter((item) => item.status === "QUEUED" || item.status === "RUNNING")
        .map((item) => item.id),
    [payload],
  );

  useEffect(() => {
    if (buildingIds.length === 0) return;
    const timer = window.setInterval(() => {
      void (async () => {
        for (const id of buildingIds) {
          try {
            const response = await fetchBatchExportRun(id);
            const previousStatus = statusRef.current.get(id);
            statusRef.current.set(id, response.data.status);
            setPayload((current) => {
              if (!current) return current;
              const history = current.history.map((item) =>
                item.id === id ? response.data : item,
              );
              return { ...current, history };
            });
            if (
              response.data.status === "SUCCEEDED" &&
              (previousStatus === "QUEUED" || previousStatus === "RUNNING")
            ) {
              setToastRun(response.data);
            }
          } catch {
            // keep polling
          }
        }
      })();
    }, 2500);
    return () => {
      window.clearInterval(timer);
    };
  }, [buildingIds]);

  function openNewExport(schedulePreset: boolean) {
    setDrawerSchedulePreset(schedulePreset);
    setDrawerOpen(true);
  }

  async function onDownload(item: BatchExportHistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await downloadBatchExport(item);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not download export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(item: BatchExportHistoryItem) {
    setBusyId(item.id);
    try {
      const response = await retryBatchExport(item.id);
      statusRef.current.set(response.data.id, response.data.status);
      setPayload((current) =>
        current
          ? {
              ...current,
              history: [response.data, ...current.history.filter((row) => row.id !== item.id)],
            }
          : current,
      );
      setFailureItem(null);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not retry export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleSchedule(schedule: BatchExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await updateBatchExportSchedule(schedule.id, {
        isActive: !schedule.isActive,
      });
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.map((item) =>
                item.id === schedule.id ? response.data : item,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not update schedule.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteSchedule(schedule: BatchExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      await deleteBatchExportSchedule(schedule.id);
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.filter((item) => item.id !== schedule.id),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not delete schedule.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <ExportsSkeleton />;
  }

  if (!payload) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center gap-4 p-8">
        <p className="text-sm text-[var(--admin-danger)]" role="alert">
          {error ?? "Could not load exports."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className={`${primaryButtonClassName} h-10 gap-2`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <Link href="/admin/reports/batches" className="hover:text-[var(--admin-primary)]">
              Batches
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--admin-on-surface)]">Exports</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Download batch data or schedule recurring delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={`${ghostButtonClassName} h-10 gap-2`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              openNewExport(false);
            }}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New export
          </button>
        </div>
      </div>

      <BatchesReportTabs active="exports" />

      {error ? (
        <div
          className="rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export history
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  {["File", "Dataset & scope", "Details", "Status", "Action"].map((heading) => (
                    <th
                      key={heading}
                      className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                        heading === "Action" ? "text-right" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {payload.history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    >
                      No exports yet. Create one to download batch data.
                    </td>
                  </tr>
                ) : (
                  payload.history.map((item) => {
                    const building = item.status === "QUEUED" || item.status === "RUNNING";
                    const ready = item.status === "SUCCEEDED" && !item.expired;
                    const expired = item.status === "SUCCEEDED" && item.expired;
                    const failed = item.status === "FAILED";
                    const rail = healthRailClassName(item);

                    return (
                      <tr
                        key={item.id}
                        className={`group relative transition-colors hover:bg-[var(--admin-surface-low)] ${
                          expired ? "opacity-60" : ""
                        }`}
                      >
                        <td className="relative px-4 py-3 whitespace-nowrap">
                          {rail ? (
                            <span
                              className={`absolute inset-y-0 left-0 w-1 ${rail}`}
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[13px] ${
                                expired
                                  ? "text-[var(--admin-on-surface-variant)] line-through"
                                  : "text-[var(--admin-on-surface)]"
                              }`}
                            >
                              {item.fileName.replace(/\.(csv|xlsx|json|pdf)$/i, "")}
                            </span>
                            <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)] uppercase">
                              {item.format}
                            </span>
                          </div>
                          {building ? (
                            <DeterminateProgressBar percent={item.progressPercent} />
                          ) : null}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span
                            className={`mb-1 inline-flex h-6 items-center rounded-sm px-2 text-[11px] font-semibold tracking-wide uppercase ${datasetChipClassName(item.dataset)}`}
                          >
                            {item.datasetLabel}
                          </span>
                          <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">
                            {item.scopeLabel}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.rowCount == null ? "-" : item.rowCount.toLocaleString()} rows
                            {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                          </div>
                          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.requestedByLabel || "-"}
                          </div>
                          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatRelative(item.createdAt)}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatUtc(item.createdAt)}
                          </div>
                          {expired ? (
                            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                              Deleted after 7 days
                            </p>
                          ) : null}
                        </td>
                        {building ? (
                          <td colSpan={2} className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <span className="inline-flex h-6 animate-pulse items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface)]">
                                {item.status === "QUEUED"
                                  ? "Queued"
                                  : item.progressPercent != null
                                    ? `Building ${item.progressPercent}%`
                                    : "Building"}
                              </span>
                              <Loader2
                                className="h-4 w-4 animate-spin text-[var(--admin-outline)]"
                                aria-hidden="true"
                              />
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              {ready ? (
                                <span className="inline-flex h-6 items-center rounded-sm bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] px-2 text-xs font-medium text-[var(--admin-success)]">
                                  Ready
                                </span>
                              ) : expired ? (
                                <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                                  Expired
                                </span>
                              ) : failed ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFailureItem(item);
                                  }}
                                  className="inline-flex h-6 items-center rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 text-xs font-medium text-[var(--admin-danger)]"
                                >
                                  Failed
                                </button>
                              ) : (
                                <span className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                                  {item.status === "CANCELLED" ? "Cancelled" : item.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ready ? (
                                <button
                                  type="button"
                                  onClick={() => void onDownload(item)}
                                  disabled={busyId === item.id}
                                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-80"
                                >
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                  Download
                                </button>
                              ) : failed ? (
                                <button
                                  type="button"
                                  onClick={() => void onRetry(item)}
                                  disabled={busyId === item.id}
                                  className="text-sm font-semibold text-[var(--admin-danger)] opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  Retry
                                </button>
                              ) : (
                                <span className="text-sm text-[var(--admin-on-surface-variant)]">
                                  -
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4 lg:col-span-4">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </h2>
          {payload.schedules.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No scheduled exports yet.
            </p>
          ) : null}
          {payload.schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`relative overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 ${
                schedule.isActive ? "" : "opacity-60"
              }`}
            >
              {schedule.isActive ? (
                <div
                  className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
              ) : null}
              <div className="mb-3 flex items-start justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
                    {schedule.name}
                  </h3>
                  <span className="mt-1 inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-[11px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    {schedule.datasetLabel}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={busyId === schedule.id}
                    onClick={() => void onDeleteSchedule(schedule)}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <PolicyToggle
                    checked={schedule.isActive}
                    disabled={busyId === schedule.id}
                    onChange={() => void onToggleSchedule(schedule)}
                    label={`Toggle ${schedule.name}`}
                  />
                </div>
              </div>
              <p className="mb-3 pl-2 text-sm text-[var(--admin-on-surface-variant)]">
                {schedule.cadenceLabel}
              </p>
              <div className="mb-3 flex flex-wrap gap-2 pl-2">
                {schedule.recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex h-6 items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    {email}
                  </span>
                ))}
                {schedule.webhookLabel ? (
                  <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    <Webhook className="h-3.5 w-3.5" aria-hidden="true" />
                    {schedule.webhookLabel}
                  </span>
                ) : null}
                {schedule.formats.map((format) => (
                  <span
                    key={format}
                    className="inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 font-mono text-[11px] text-[var(--admin-on-surface)] uppercase"
                  >
                    {format}
                  </span>
                ))}
              </div>
              <p className="flex items-center gap-1.5 pl-2 font-mono text-[11px] text-[var(--admin-primary)]">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {schedule.nextRunLabel}
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              openNewExport(true);
            }}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-6 text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-semibold">New schedule</span>
          </button>
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
        <span>
          Download links expire after the artifact TTL. Re-run an export or use a scheduled delivery
          to receive a fresh signed URL when files expire.
        </span>
      </div>

      <BatchesNewExportDrawer
        open={drawerOpen}
        summaryColumns={payload.summaryColumns}
        learnerColumns={payload.learnerColumns}
        capabilities={payload.capabilities}
        initialScheduleEnabled={drawerSchedulePreset}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onCreated={(run, schedule) => {
          statusRef.current.set(run.id, run.status);
          setPayload((current) =>
            current
              ? {
                  ...current,
                  history: [run, ...current.history],
                  schedules: schedule ? [schedule, ...current.schedules] : current.schedules,
                }
              : current,
          );
          if (run.status === "SUCCEEDED") setToastRun(run);
        }}
      />

      {failureItem ? (
        <FailureDrawer
          item={failureItem}
          busy={busyId === failureItem.id}
          onClose={() => {
            setFailureItem(null);
          }}
          onRetry={() => void onRetry(failureItem)}
        />
      ) : null}

      {toastRun ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-lg">
          <CheckCircle2 className="h-5 w-5 text-[var(--admin-success)]" aria-hidden="true" />
          <span className="text-sm text-[var(--admin-on-surface)]">
            <span className="font-mono text-[13px]">{toastRun.fileName}</span> is ready
          </span>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--admin-primary)]"
            onClick={() => void onDownload(toastRun)}
          >
            Download
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setToastRun(null);
            }}
            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
