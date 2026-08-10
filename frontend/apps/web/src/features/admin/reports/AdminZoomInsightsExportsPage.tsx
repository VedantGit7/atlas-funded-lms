"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  deleteZoomExportSchedule,
  downloadZoomExport,
  fetchZoomExportRun,
  fetchZoomInsightsExports,
  retryZoomExport,
  updateZoomExportSchedule,
  type ZoomExportDataset,
  type ZoomExportHistoryItem,
  type ZoomExportScheduleItem,
  type ZoomInsightsExportsPayload,
} from "./admin-zoom-insights-exports-api";
import { syncZoomConnectionNow } from "./admin-zoom-insights-roster-api";
import { ZoomInsightsNewExportModal } from "./ZoomInsightsNewExportModal";

type ModuleTab = "meetings" | "participants" | "unmatched" | "connection" | "exports";

const MODULE_TABS: Array<{ key: ModuleTab; label: string; href: string }> = [
  { key: "meetings", label: "Meetings", href: "/admin/reports/zoom-insights" },
  {
    key: "participants",
    label: "Participants",
    href: "/admin/reports/zoom-insights/participants",
  },
  { key: "unmatched", label: "Unmatched", href: "/admin/reports/zoom-insights/unmatched" },
  { key: "connection", label: "Connection", href: "/admin/reports/zoom-insights/connection" },
  { key: "exports", label: "Exports", href: "/admin/reports/zoom-insights/exports" },
];

function formatRelative(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? "" : "s"} ago`;
}

function datasetChipClassName(dataset: ZoomExportDataset): string {
  if (dataset === "meetings") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  if (dataset === "participants") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (dataset === "unmatched") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(item: ZoomExportHistoryItem): string {
  if (item.status === "SUCCEEDED" && item.expired) return "Expired";
  if (item.status === "SUCCEEDED") return "Ready";
  if (item.status === "RUNNING") return "Building";
  if (item.status === "QUEUED") return "Queued";
  if (item.status === "FAILED") return "Failed";
  return "Cancelled";
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

function FailurePopover({
  item,
  onClose,
  onRetry,
  busy,
}: {
  item: ZoomExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="mb-3 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-sm font-semibold text-[var(--admin-on-surface)]">
              Export failed
            </h3>
            <p className="mt-1 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
              {item.fileName}
            </p>
            <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
              {item.errorMessage ?? item.errorCode ?? "Export generation failed."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-9`}>
            Close
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={`${primaryButtonClassName} h-9 gap-2`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleTabs({ active }: { active: ModuleTab }) {
  return (
    <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
      {MODULE_TABS.map((tab) => {
        const selected = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            className={[
              "px-1 pb-2 text-sm font-semibold transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function ExportsSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="h-8 w-56 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7" />
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-5" />
      </div>
    </div>
  );
}

export function AdminZoomInsightsExportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ZoomInsightsExportsPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<ZoomExportHistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<ZoomExportHistoryItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const statusRef = useRef<Map<string, ZoomExportHistoryItem["status"]>>(new Map());

  const applyPayload = useCallback((next: ZoomInsightsExportsPayload) => {
    setPayload(next);
    for (const item of next.history) {
      if (!statusRef.current.has(item.id)) {
        statusRef.current.set(item.id, item.status);
      }
    }
  }, []);

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      if (!options?.soft) setLoading(true);
      setError(null);
      try {
        const response = await fetchZoomInsightsExports();
        applyPayload(response.data);
      } catch (caught) {
        setError(caught instanceof ClientApiError ? caught.message : "Could not load exports.");
      } finally {
        if (!options?.soft) setLoading(false);
      }
    },
    [applyPayload],
  );

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
            const response = await fetchZoomExportRun(id);
            const previousStatus = statusRef.current.get(id);
            statusRef.current.set(id, response.data.status);
            setPayload((current) => {
              if (!current) return current;
              return {
                ...current,
                history: current.history.map((item) => (item.id === id ? response.data : item)),
              };
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

  useEffect(() => {
    if (!toastRun) return;
    const timer = window.setTimeout(() => {
      setToastRun(null);
    }, 8000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toastRun]);

  async function onSyncNow() {
    setSyncing(true);
    setError(null);
    try {
      await syncZoomConnectionNow();
      await load({ soft: true });
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not sync Zoom.");
    } finally {
      setSyncing(false);
    }
  }

  async function onDownload(item: ZoomExportHistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await downloadZoomExport(item);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not download export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(item: ZoomExportHistoryItem) {
    setBusyId(item.id);
    try {
      const response = await retryZoomExport(item.id);
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

  async function onToggleSchedule(schedule: ZoomExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await updateZoomExportSchedule(schedule.id, {
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

  async function onDeleteSchedule(schedule: ZoomExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      await deleteZoomExportSchedule(schedule.id);
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

  if (loading) return <ExportsSkeleton />;

  if (!payload) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-4 p-8">
        <p className="text-sm text-[var(--admin-danger)]" role="alert">
          {error ?? "Could not load exports."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className={`${primaryButtonClassName} h-10 gap-2`}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const connected = payload.connection.status === "connected";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <Link href="/admin/reports/zoom-insights" className="hover:text-[var(--admin-primary)]">
              Zoom Insights
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--admin-on-surface)]">Exports</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Download Zoom meeting and participant data, or schedule recurring delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={`${ghostButtonClassName} h-11 gap-2`}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setSchedulePreset(false);
              setModalOpen(true);
            }}
            className={`${primaryButtonClassName} h-11 gap-2`}
          >
            <Plus className="h-4 w-4" />
            New export
          </button>
        </div>
      </div>

      <ModuleTabs active="exports" />

      {error ? (
        <div
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-[var(--admin-success)]" : "bg-[var(--admin-danger)]"
            }`}
            aria-hidden="true"
          />
          <span className="font-semibold text-[var(--admin-on-surface)]">
            {connected ? "Zoom connected" : "Zoom disconnected"}
          </span>
          <span aria-hidden="true">·</span>
          <span>last synced {formatRelative(payload.connection.lastSyncedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {payload.connection.meetingsImportedToday} meeting
            {payload.connection.meetingsImportedToday === 1 ? "" : "s"} imported today
          </span>
        </div>
        <button
          type="button"
          disabled={syncing || !connected}
          onClick={() => void onSyncNow()}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Sync now
        </button>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="flex w-full flex-col gap-4 lg:w-[60%]">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Export history</h2>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    {["File", "Dataset", "Scope", "Rows", "Size", "Status", ""].map((heading) => (
                      <th
                        key={heading || "actions"}
                        className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                          heading === "Rows" || heading === "Size" ? "text-right" : ""
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
                        colSpan={7}
                        className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No exports yet. Create one to download Zoom data.
                      </td>
                    </tr>
                  ) : (
                    payload.history.map((item) => {
                      const building = item.status === "QUEUED" || item.status === "RUNNING";
                      const ready = item.status === "SUCCEEDED" && !item.expired;
                      const expired = item.status === "SUCCEEDED" && item.expired;
                      const failed = item.status === "FAILED";
                      const baseName = item.fileName.replace(/\.(csv|xlsx|json|pdf)$/i, "");

                      return (
                        <tr
                          key={item.id}
                          className={`group relative h-11 transition-colors hover:bg-[var(--admin-surface-low)] ${
                            expired ? "opacity-60" : ""
                          }`}
                        >
                          <td className="relative px-4 font-mono text-[13px] whitespace-nowrap text-[var(--admin-on-surface)]">
                            {building ? (
                              <div
                                className="absolute bottom-0 left-0 h-0.5 bg-[var(--admin-primary)] opacity-60 transition-opacity group-hover:opacity-100"
                                style={{
                                  width: `${item.progressPercent == null ? 45 : Math.min(100, Math.max(8, item.progressPercent))}%`,
                                }}
                                aria-hidden="true"
                              />
                            ) : null}
                            {baseName}{" "}
                            <span className="ml-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[10px] text-[var(--admin-on-surface-variant)] uppercase">
                              .{item.format}
                            </span>
                          </td>
                          <td className="px-4">
                            <span
                              className={`inline-flex items-center rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-[12px] whitespace-nowrap ${datasetChipClassName(item.dataset)}`}
                            >
                              {item.datasetLabel}
                            </span>
                          </td>
                          <td
                            className="max-w-[140px] truncate px-4 text-[12px] text-[var(--admin-on-surface-variant)]"
                            title={item.scopeLabel}
                          >
                            {item.scopeLabel}
                          </td>
                          <td className="px-4 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.rowCount == null ? "--" : item.rowCount.toLocaleString()}
                          </td>
                          <td className="px-4 text-right font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                            {item.sizeLabel ?? "--"}
                          </td>
                          <td className="px-4">
                            {failed ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setFailureItem(item);
                                }}
                                className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-2 py-0.5 font-mono text-[11px] font-medium tracking-wider text-[var(--admin-danger)] uppercase"
                              >
                                Failed
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium tracking-wider uppercase ${
                                  ready
                                    ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
                                    : building
                                      ? "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]"
                                      : item.status === "QUEUED"
                                        ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
                                        : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
                                }`}
                                title={expired ? "Files are deleted after 7 days" : undefined}
                              >
                                {statusLabel(item)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 text-right">
                            {ready ? (
                              <button
                                type="button"
                                aria-label={`Download ${item.fileName}`}
                                disabled={busyId === item.id}
                                onClick={() => void onDownload(item)}
                                className="text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--admin-primary)]"
                              >
                                <Download className="h-[18px] w-[18px]" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
            {payload.capabilities.note}
          </p>
        </section>

        <section className="flex w-full flex-col gap-4 lg:w-[40%]">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </h2>
          <div className="flex flex-col gap-4">
            {payload.schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition-all ${
                  schedule.isActive
                    ? "hover:border-[var(--admin-outline)]"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="mb-1 truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {schedule.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-[12px] ${datasetChipClassName(schedule.dataset)}`}
                      >
                        {schedule.datasetLabel}
                      </span>
                      <span className="rounded-sm border border-[var(--admin-border)] px-1.5 font-mono text-[11px] tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                        .{schedule.formats[0] ?? "csv"}
                      </span>
                    </div>
                  </div>
                  <PolicyToggle
                    checked={schedule.isActive}
                    disabled={busyId === schedule.id}
                    onChange={() => void onToggleSchedule(schedule)}
                    label={`Toggle ${schedule.name}`}
                  />
                </div>
                <div className="mt-4 space-y-2 text-[12px]">
                  <div className="flex items-center gap-2 text-[var(--admin-on-surface)]">
                    <CalendarClock className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                    {schedule.cadenceLabel}
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                    <div className="flex flex-wrap gap-1">
                      {schedule.recipients.length === 0 ? (
                        <span className="text-[var(--admin-on-surface-variant)]">
                          Deliver to requester
                        </span>
                      ) : (
                        schedule.recipients.map((email) => (
                          <span
                            key={email}
                            className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-[var(--admin-on-surface)]"
                          >
                            {email}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--admin-border)] pt-4 text-[12px]">
                  <span
                    className={
                      schedule.isActive
                        ? "font-semibold text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface-variant)]"
                    }
                  >
                    {schedule.isActive ? schedule.nextRunLabel : "Paused"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={busyId === schedule.id}
                    onClick={() => void onDeleteSchedule(schedule)}
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setSchedulePreset(true);
                setModalOpen(true);
              }}
              className="group flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--admin-outline)] bg-transparent p-5 text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)] hover:text-[var(--admin-primary)]"
            >
              <Plus className="h-6 w-6 transition-transform group-hover:scale-110" />
              <span className="text-sm font-semibold">New schedule</span>
            </button>
          </div>
        </section>
      </div>

      <ZoomInsightsNewExportModal
        open={modalOpen}
        capabilities={payload.capabilities}
        initialScheduleEnabled={schedulePreset}
        onClose={() => {
          setModalOpen(false);
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
        <FailurePopover
          item={failureItem}
          busy={busyId === failureItem.id}
          onClose={() => {
            setFailureItem(null);
          }}
          onRetry={() => void onRetry(failureItem)}
        />
      ) : null}

      {toastRun ? (
        <div className="fixed right-6 bottom-6 z-50 flex min-w-[320px] max-w-md items-center gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-[var(--admin-success)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[13px] text-[var(--admin-on-surface)]">
              {toastRun.fileName}
            </p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">is ready</p>
          </div>
          <button
            type="button"
            disabled={!toastRun.downloadAvailable || busyId === toastRun.id}
            onClick={() => void onDownload(toastRun)}
            className="shrink-0 text-sm font-semibold text-[var(--admin-primary)]"
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
