"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dropdownItemClassName,
  dropdownPanelSurfaceClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  deleteResourceUsageExportSchedule,
  downloadResourceUsageExport,
  fetchResourceUsageExportRun,
  fetchResourceUsageExports,
  retryResourceUsageExport,
  runResourceUsageExportScheduleNow,
  updateResourceUsageExportSchedule,
  type ResourceUsageExportsPayload,
  type RuExportHistoryItem,
  type RuExportScheduleItem,
} from "./admin-resource-usage-exports-api";
import { ResourceUsageNewExportModal } from "./ResourceUsageNewExportModal";

const PAGE_SIZE = 10;

const MODULE_LINKS: Array<{ label: string; href: string; current?: boolean }> = [
  { label: "Overview", href: "/admin/reports/resource-usage" },
  { label: "History", href: "/admin/reports/resource-usage/history" },
  { label: "Storage", href: "/admin/reports/resource-usage/storage" },
  { label: "Dormant", href: "/admin/reports/resource-usage/dormant" },
  { label: "Inactive", href: "/admin/reports/resource-usage/inactive-learners" },
  { label: "Exports", href: "/admin/reports/resource-usage/exports", current: true },
];

function formatRows(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString();
}

function statusLabel(item: RuExportHistoryItem): string {
  if (item.status === "SUCCEEDED" && item.expired) return "Expired";
  if (item.status === "SUCCEEDED") return "Ready";
  if (item.status === "RUNNING") return "Building";
  if (item.status === "QUEUED") return "Queued";
  if (item.status === "FAILED") return "Failed";
  return "Cancelled";
}

function statusPillClass(item: RuExportHistoryItem): string {
  const label = statusLabel(item);
  if (label === "Ready") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (label === "Building") {
    return "border-[var(--admin-primary-strong)] bg-[color-mix(in_srgb,var(--admin-primary-strong)_10%,var(--admin-surface))] text-[var(--admin-primary-strong)]";
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
  return "rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]";
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
  item: RuExportHistoryItem;
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
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-sm bg-[var(--admin-surface-high)]" />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7" />
        <div className="h-80 animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-5" />
      </div>
    </div>
  );
}

function ModuleLinks() {
  return (
    <nav
      aria-label="Resource usage sections"
      className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--admin-on-surface-variant)]"
    >
      {MODULE_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          aria-current={link.current ? "page" : undefined}
          className={
            link.current
              ? "font-semibold text-[var(--admin-primary-strong)]"
              : "hover:text-[var(--admin-primary)]"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminResourceUsageExportsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ResourceUsageExportsPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<RuExportHistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<RuExportHistoryItem | null>(null);
  const [page, setPage] = useState(0);
  const statusRef = useRef<Map<string, RuExportHistoryItem["status"]>>(new Map());

  const applyPayload = useCallback((next: ResourceUsageExportsPayload) => {
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
        const response = await fetchResourceUsageExports();
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
            const response = await fetchResourceUsageExportRun(id);
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

  const totalPages = useMemo(() => {
    if (!payload) return 1;
    return Math.max(1, Math.ceil(payload.history.length / PAGE_SIZE));
  }, [payload]);

  const pagedHistory = useMemo(() => {
    if (!payload) return [];
    const start = page * PAGE_SIZE;
    return payload.history.slice(start, start + PAGE_SIZE);
  }, [payload, page]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  async function onDownload(item: RuExportHistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await downloadResourceUsageExport(item.id, item.format);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not download export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(item: RuExportHistoryItem) {
    setBusyId(item.id);
    try {
      const response = await retryResourceUsageExport(item.id);
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
      setPage(0);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not retry export.");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleSchedule(schedule: RuExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await updateResourceUsageExportSchedule(schedule.id, {
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

  async function onDeleteSchedule(schedule: RuExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      await deleteResourceUsageExportSchedule(schedule.id);
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

  async function onRunScheduleNow(schedule: RuExportScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await runResourceUsageExportScheduleNow(schedule.id);
      statusRef.current.set(response.data.run.id, response.data.run.status);
      setPayload((current) =>
        current
          ? {
              ...current,
              history: [response.data.run, ...current.history],
            }
          : current,
      );
      setPage(0);
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
      <div className="flex flex-col items-center gap-4 py-8">
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
    <div className="flex flex-col gap-6">
      <ModuleLinks />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Download usage data or schedule recurring delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load({ soft: true })}
            className={`${ghostButtonClassName} h-10 gap-2`}
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
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            <Plus className="h-4 w-4" />
            New export
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 flex flex-col gap-4 lg:col-span-7">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Export history</h3>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    {["File & Format", "Scope", "Rows", "Size", "Status", "Action"].map(
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
                  {pagedHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No exports yet. Create one to download usage data.
                      </td>
                    </tr>
                  ) : (
                    pagedHistory.map((item) => {
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
                          className={`group relative h-11 transition-colors hover:bg-[var(--admin-surface-high)] ${
                            failed
                              ? "border-l-2 border-l-[var(--admin-danger)]"
                              : expired
                                ? "bg-[var(--admin-surface-low)] opacity-75"
                                : ""
                          }`}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`font-mono text-[13px] ${
                                  expired
                                    ? "text-[var(--admin-on-surface-variant)] line-through"
                                    : "text-[var(--admin-on-surface)]"
                                }`}
                              >
                                {item.fileName}
                              </span>
                              <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                                {ext}
                              </span>
                            </div>
                            <span className={`mt-1 inline-block ${datasetChipClass()}`}>
                              {item.datasetLabel}
                            </span>
                          </td>
                          <td className="max-w-[180px] truncate px-4 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                            {item.scopeLabel}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {formatRows(item.rowCount)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.sizeLabel ?? "-"}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={!failed}
                              onClick={() => {
                                if (failed) setFailureItem(item);
                              }}
                              title={
                                failed
                                  ? (item.errorMessage ?? item.errorCode ?? undefined)
                                  : undefined
                              }
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
                                className="inline-flex items-center justify-center text-[var(--admin-primary-strong)] transition-transform hover:opacity-80 active:translate-y-px disabled:opacity-50"
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
                                title={item.errorMessage ?? item.errorCode ?? "Export failed"}
                                className="text-[12px] font-semibold text-[var(--admin-primary-strong)] hover:underline disabled:opacity-50"
                              >
                                Retry
                              </button>
                            ) : expired ? (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void onRetry(item)}
                                className="text-[12px] font-semibold text-[var(--admin-primary-strong)] hover:underline disabled:opacity-50"
                              >
                                Re-run
                              </button>
                            ) : queued ? (
                              <Hourglass
                                className="ml-auto h-[18px] w-[18px] text-[var(--admin-outline)]"
                                aria-label="Queued"
                              />
                            ) : building ? (
                              <Loader2
                                className="ml-auto h-[18px] w-[18px] animate-spin text-[var(--admin-outline)]"
                                aria-label="Building"
                              />
                            ) : (
                              <span className="text-[var(--admin-outline)]">-</span>
                            )}
                          </td>
                          {building && progress != null ? (
                            <td className="pointer-events-none absolute right-0 bottom-0 left-0 h-px border-0 bg-[var(--admin-border)] p-0">
                              <div
                                className="h-full bg-[var(--admin-primary-strong)] transition-[width] duration-500"
                                style={{ width: `${String(progress)}%` }}
                              />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {payload.history.length > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2">
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {payload.history.length.toLocaleString()} exports
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => {
                      setPage((current) => Math.max(0, current - 1));
                    }}
                    aria-label="Previous page"
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages - 1}
                    onClick={() => {
                      setPage((current) => Math.min(totalPages - 1, current + 1));
                    }}
                    aria-label="Next page"
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-right">
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {payload.capabilities.note}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-12 flex flex-col gap-4 lg:col-span-5">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </h3>
          {payload.schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
              No schedules yet. Create one from New export.
            </div>
          ) : (
            payload.schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`relative rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm transition-colors hover:border-[var(--admin-outline)] ${
                  schedule.isActive ? "" : "opacity-60"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h4
                    className={`text-base font-semibold text-[var(--admin-on-surface)] ${
                      schedule.isActive ? "" : "line-through"
                    }`}
                  >
                    {schedule.name}
                  </h4>
                  <ScheduleMenu
                    busy={busyId === schedule.id}
                    onRunNow={() => void onRunScheduleNow(schedule)}
                    onDelete={() => void onDeleteSchedule(schedule)}
                  />
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={datasetChipClass()}>{schedule.datasetLabel}</span>
                  {schedule.formats[0] ? (
                    <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                      {schedule.formats[0].toUpperCase()}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 text-[12px]">
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
                <div className="mt-4 flex justify-end">
                  <PolicyToggle
                    checked={schedule.isActive}
                    disabled={busyId === schedule.id}
                    onChange={() => void onToggleSchedule(schedule)}
                    label={`Toggle ${schedule.name}`}
                  />
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
            className="group flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-bg)] p-6 text-[var(--admin-on-surface-variant)] transition-all duration-200 hover:border-[var(--admin-primary-strong)] hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary-strong)]"
          >
            <Plus className="mb-2 h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="text-base font-semibold">New schedule</span>
          </button>
        </section>
      </div>

      <ResourceUsageNewExportModal
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
          setPage(0);
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
