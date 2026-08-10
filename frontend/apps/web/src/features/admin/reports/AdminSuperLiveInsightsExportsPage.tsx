"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Download,
  Hourglass,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  deleteSuperLiveInsightsExportSchedule,
  downloadSuperLiveInsightsExport,
  fetchSuperLiveInsightsExportRun,
  fetchSuperLiveInsightsExports,
  retrySuperLiveInsightsExport,
  runSuperLiveInsightsExportScheduleNow,
  updateSuperLiveInsightsExportSchedule,
  type SliExportHistoryItem,
  type SliExportScheduleItem,
  type SuperLiveInsightsExportsPayload,
} from "./admin-super-live-insights-exports-api";
import { SuperLiveInsightsModuleTabs } from "./SuperLiveInsightsModuleTabs";
import { SuperLiveInsightsNewExportModal } from "./SuperLiveInsightsNewExportModal";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

function formatRelative(value: string | null): string {
  if (!value) return "-";
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

function formatRows(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString();
}

function statusLabel(item: SliExportHistoryItem): string {
  if (item.status === "SUCCEEDED" && item.expired) return "Expired";
  if (item.status === "SUCCEEDED") return "Ready";
  if (item.status === "RUNNING") return "Building";
  if (item.status === "QUEUED") return "Queued";
  if (item.status === "FAILED") return "Failed";
  return "Cancelled";
}

function statusPillClass(item: SliExportHistoryItem): string {
  const label = statusLabel(item);
  if (label === "Ready") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (label === "Building") {
    return "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  if (label === "Queued") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (label === "Failed") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function datasetChipClass(): string {
  return "rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]";
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
  onRetryAsCsv,
  busy,
}: {
  item: SliExportHistoryItem;
  onClose: () => void;
  onRetry: () => void;
  onRetryAsCsv: () => void;
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
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={`${secondaryButtonClassName} h-9`}>
            Close
          </button>
          {item.format !== "csv" ? (
            <button
              type="button"
              onClick={onRetryAsCsv}
              disabled={busy}
              className={`${secondaryButtonClassName} h-9 gap-2`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Retry as CSV
            </button>
          ) : null}
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

function ScheduleMenu({
  busy,
  onRunNow,
  onDelete,
}: {
  busy: boolean;
  onRunNow: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Schedule actions"
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className={`absolute top-9 right-0 z-20 w-44 bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`}
          role="menu"
        >
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              className={dropdownItemClassName}
              onClick={() => {
                setOpen(false);
                onRunNow();
              }}
            >
              Run now
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${dropdownItemClassName} text-[var(--admin-danger)]`}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="h-10 w-full animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7" />
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-5" />
      </div>
    </div>
  );
}

export function AdminSuperLiveInsightsExportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SuperLiveInsightsExportsPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<SliExportHistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<SliExportHistoryItem | null>(null);
  const statusRef = useRef<Map<string, SliExportHistoryItem["status"]>>(new Map());

  const applyPayload = useCallback((next: SuperLiveInsightsExportsPayload) => {
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
        const response = await fetchSuperLiveInsightsExports();
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
            const response = await fetchSuperLiveInsightsExportRun(id);
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

  async function onDownload(item: SliExportHistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await downloadSuperLiveInsightsExport(item);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not download export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(item: SliExportHistoryItem, format?: "csv") {
    setBusyId(item.id);
    try {
      const response = await retrySuperLiveInsightsExport(item.id, format ? { format } : undefined);
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

  async function onToggleSchedule(schedule: SliExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await updateSuperLiveInsightsExportSchedule(schedule.id, {
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

  async function onDeleteSchedule(schedule: SliExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      await deleteSuperLiveInsightsExportSchedule(schedule.id);
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

  async function onRunScheduleNow(schedule: SliExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await runSuperLiveInsightsExportScheduleNow(schedule.id);
      statusRef.current.set(response.data.run.id, response.data.run.status);
      setPayload((current) =>
        current
          ? {
              ...current,
              history: [response.data.run, ...current.history],
            }
          : current,
      );
      if (response.data.run.status === "SUCCEEDED") {
        setToastRun(response.data.run);
      }
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not run schedule.");
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

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Download session metrics or schedule recurring delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={`${secondaryButtonClassName} h-11 gap-2`}
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

      <SuperLiveInsightsModuleTabs active="exports" />

      {error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void load({ soft: true })}
            className="shrink-0 text-[13px] font-semibold underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 flex flex-col gap-4 lg:col-span-7">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Export history</h2>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    {["File", "Dataset", "Rows", "Size", "Created", "Status", "Action"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                            heading === "Rows" || heading === "Size" || heading === "Action"
                              ? "text-right"
                              : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {payload.history.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No exports yet. Create one to download session metrics.
                      </td>
                    </tr>
                  ) : (
                    payload.history.map((item) => {
                      const building = item.status === "QUEUED" || item.status === "RUNNING";
                      const ready = item.status === "SUCCEEDED" && !item.expired;
                      const expired = item.status === "SUCCEEDED" && item.expired;
                      const failed = item.status === "FAILED";
                      const queued = item.status === "QUEUED";
                      const ext = item.format.toUpperCase();
                      const progress =
                        item.progressPercent != null
                          ? Math.min(100, Math.max(0, item.progressPercent))
                          : building
                            ? 33
                            : null;

                      return (
                        <tr
                          key={item.id}
                          className={`group h-11 transition-colors hover:bg-[var(--admin-surface-high)] ${
                            expired ? "bg-[var(--admin-surface-low)] opacity-75" : ""
                          }`}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                                  {ext}
                                </span>
                                <span
                                  className={`font-mono text-[13px] ${
                                    expired
                                      ? "text-[var(--admin-on-surface-variant)] line-through"
                                      : "text-[var(--admin-on-surface)]"
                                  }`}
                                >
                                  {item.fileName}
                                </span>
                              </div>
                              {building && progress != null ? (
                                <div className="h-0.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--admin-border)]">
                                  <div
                                    className="h-full bg-[var(--admin-primary)] transition-[width] duration-500"
                                    style={{ width: `${String(progress)}%` }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className={datasetChipClass()}>{item.datasetLabel}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatRows(item.rowCount)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.sizeLabel ?? "-"}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--admin-on-surface)]">
                            {formatRelative(item.createdAt)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={!failed}
                              onClick={() => {
                                if (failed) setFailureItem(item);
                              }}
                              className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide uppercase ${statusPillClass(item)} ${
                                failed ? "cursor-help" : ""
                              }`}
                            >
                              {statusLabel(item)}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {ready ? (
                              <button
                                type="button"
                                aria-label={`Download ${item.fileName}`}
                                disabled={busyId === item.id}
                                onClick={() => void onDownload(item)}
                                className="inline-flex items-center justify-center text-[var(--admin-primary)] transition-transform hover:opacity-80 active:translate-y-px disabled:opacity-50"
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                                ) : (
                                  <Download className="h-[18px] w-[18px]" />
                                )}
                              </button>
                            ) : failed ? (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void onRetry(item)}
                                className="text-[12px] font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
                              >
                                Retry
                              </button>
                            ) : expired ? (
                              <Ban
                                className="ml-auto h-[18px] w-[18px] text-[var(--admin-outline)]"
                                aria-label="Expired"
                              />
                            ) : queued ? (
                              <Hourglass
                                className="ml-auto h-[18px] w-[18px] text-[var(--admin-outline)]"
                                aria-hidden="true"
                              />
                            ) : (
                              <Download
                                className="ml-auto h-[18px] w-[18px] text-[var(--admin-outline)] opacity-40"
                                aria-hidden="true"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-right">
              <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                Files are deleted after 7 days
              </span>
            </div>
          </div>
        </section>

        <section className="col-span-12 flex flex-col gap-4 lg:col-span-5">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </h2>
          {payload.schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
              No schedules yet. Create one from New export.
            </div>
          ) : (
            payload.schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`relative overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm transition-colors hover:border-[var(--admin-outline)] ${
                  schedule.isActive ? "" : "opacity-60"
                }`}
              >
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1 ${
                    schedule.isActive ? "bg-[var(--admin-success)]" : "bg-[var(--admin-outline)]"
                  }`}
                  aria-hidden="true"
                />
                <div className="mb-3 flex items-start justify-between gap-2 pl-2">
                  <h3
                    className={`text-base font-semibold text-[var(--admin-on-surface)] ${
                      schedule.isActive ? "" : "line-through"
                    }`}
                  >
                    {schedule.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <PolicyToggle
                      checked={schedule.isActive}
                      disabled={busyId === schedule.id}
                      onChange={() => void onToggleSchedule(schedule)}
                      label={`Toggle ${schedule.name}`}
                    />
                    <ScheduleMenu
                      busy={busyId === schedule.id}
                      onRunNow={() => void onRunScheduleNow(schedule)}
                      onDelete={() => void onDeleteSchedule(schedule)}
                    />
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2 pl-2">
                  <span className={datasetChipClass()}>{schedule.datasetLabel}</span>
                  {schedule.formats[0] ? (
                    <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                      {schedule.formats[0].toUpperCase()}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 pl-2 text-[12px]">
                  <div className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" />
                    <div>
                      <span className="block text-[var(--admin-on-surface)]">
                        {schedule.cadenceLabel}
                      </span>
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {schedule.nextRunLabel}
                      </span>
                    </div>
                  </div>
                  {schedule.recipients.length > 0 ? (
                    <div className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" />
                      <div className="flex flex-wrap gap-1">
                        {schedule.recipients.map((email) => (
                          <span
                            key={email}
                            className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-[var(--admin-on-surface-variant)]"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={() => {
              setSchedulePreset(true);
              setModalOpen(true);
            }}
            className="group flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-bg)] p-6 text-[var(--admin-on-surface-variant)] transition-all duration-200 hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary)]"
          >
            <Plus className="mb-2 h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="text-base font-semibold">New schedule</span>
          </button>
        </section>
      </div>

      <SuperLiveInsightsNewExportModal
        open={modalOpen}
        capabilities={payload.capabilities}
        estimates={payload.estimates}
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
                  schedules: schedule
                    ? [schedule, ...current.schedules.filter((item) => item.id !== schedule.id)]
                    : current.schedules,
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
          onRetryAsCsv={() => void onRetry(failureItem, "csv")}
        />
      ) : null}

      {toastRun ? (
        <div className="fixed right-6 bottom-6 z-50 flex max-w-sm items-center rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-on-surface)] px-4 py-3 text-[var(--admin-surface)] shadow-lg motion-safe:animate-[admin-dropdown-in_0.4s_cubic-bezier(0.16,1,0.3,1)]">
          <CheckCircle2 className="mr-3 h-5 w-5 shrink-0 text-[var(--admin-success)]" />
          <div className="mr-4 flex-1 text-sm">
            <span className="font-mono text-[13px]">{toastRun.fileName}</span> is ready.
          </div>
          <button
            type="button"
            onClick={() => void onDownload(toastRun)}
            className="text-[12px] font-semibold tracking-wider text-[var(--admin-primary-container)] uppercase hover:opacity-90 active:translate-y-px"
          >
            Download
          </button>
        </div>
      ) : null}
    </div>
  );
}
