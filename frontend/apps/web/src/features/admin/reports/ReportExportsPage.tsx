"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Webhook,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import type {
  ReportExportHistoryOf,
  ReportExportScheduleOf,
  ReportExportsApi,
  ReportExportsLedger,
} from "./admin-report-exports-api";
import {
  ExportFailureDrawer,
  ExportReadyToast,
  ExportsSkeleton,
  PolicyToggle,
  exportRowState,
  type ExportHistoryColumn,
} from "./report-exports-kit";

/** What a report's page hands its new-export dialog. */
export type NewExportSlot<TPayload extends ReportExportsLedger> = {
  open: boolean;
  /** Opened from "New schedule", so the dialog starts with scheduling on. */
  schedulePreset: boolean;
  payload: TPayload;
  onClose: () => void;
  onCreated: (
    run: ReportExportHistoryOf<TPayload>,
    schedule: ReportExportScheduleOf<TPayload> | null,
  ) => void;
};

export type ReportExportsPageProps<TPayload extends ReportExportsLedger> = {
  api: ReportExportsApi<TPayload>;
  /** "panel" sits inside another page's header and tabs, one heading level down. */
  layout?: "page" | "panel";
  /** Links before the current "Exports" crumb. */
  breadcrumbs?: Array<{ label: string; href: string }>;
  description: string;
  tabs?: ReactNode;
  columns: Array<ExportHistoryColumn<ReportExportHistoryOf<TPayload>>>;
  emptyHistoryText: string;
  /** Filters the history by file name, dataset and scope. */
  search?: { placeholder: string };
  /** Pages the history this many rows at a time. */
  pageSize?: number;
  /** A line under the history table. */
  historyNote?: string;
  /** The note under both columns, fixed or read from the payload. */
  footnote?: string | ((payload: TPayload) => string);
  renderNewExport: (slot: NewExportSlot<TPayload>) => ReactNode;
};

const POLL_INTERVAL_MS = 2500;

function message(caught: unknown, fallback: string): string {
  return caught instanceof ClientApiError ? caught.message : fallback;
}

/** Loads a report's exports, polls the ones still building, and runs the page's actions. */
function useReportExports<TPayload extends ReportExportsLedger>(api: ReportExportsApi<TPayload>) {
  type HistoryItem = ReportExportHistoryOf<TPayload>;
  type ScheduleItem = ReportExportScheduleOf<TPayload>;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TPayload | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastRun, setToastRun] = useState<HistoryItem | null>(null);
  const statusRef = useRef<Map<string, HistoryItem["status"]>>(new Map());

  const applyPayload = useCallback((next: TPayload) => {
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
      const response = await api.fetchExports();
      applyPayload(response.data);
    } catch (caught) {
      setError(message(caught, "Could not load exports."));
    } finally {
      setLoading(false);
    }
  }, [api, applyPayload]);

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
            const response = await api.fetchRun(id);
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
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [api, buildingIds]);

  async function download(item: HistoryItem) {
    if (!item.downloadAvailable) return;
    setBusyId(item.id);
    try {
      await api.download(item);
    } catch (caught) {
      setError(message(caught, "Could not download export."));
    } finally {
      setBusyId(null);
    }
  }

  /** Resolves true when the retry started. */
  async function retry(item: HistoryItem): Promise<boolean> {
    setBusyId(item.id);
    try {
      const response = await api.retry(item.id);
      statusRef.current.set(response.data.id, response.data.status);
      setPayload((current) =>
        current
          ? {
              ...current,
              history: [response.data, ...current.history.filter((row) => row.id !== item.id)],
            }
          : current,
      );
      return true;
    } catch (caught) {
      setError(message(caught, "Could not retry export."));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSchedule(schedule: ScheduleItem) {
    setBusyId(schedule.id);
    try {
      const response = await api.updateSchedule(schedule.id, { isActive: !schedule.isActive });
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
      setError(message(caught, "Could not update schedule."));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSchedule(schedule: ScheduleItem) {
    setBusyId(schedule.id);
    try {
      await api.deleteSchedule(schedule.id);
      setPayload((current) =>
        current
          ? {
              ...current,
              schedules: current.schedules.filter((item) => item.id !== schedule.id),
            }
          : current,
      );
    } catch (caught) {
      setError(message(caught, "Could not delete schedule."));
    } finally {
      setBusyId(null);
    }
  }

  function created(run: HistoryItem, schedule: ScheduleItem | null) {
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
  }

  return {
    loading,
    error,
    payload,
    busyId,
    toastRun,
    dismissToast: () => {
      setToastRun(null);
    },
    load,
    download,
    retry,
    toggleSchedule,
    deleteSchedule,
    created,
  };
}

const chipClassName = "inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium";

function StatusCell({
  item,
  onShowFailure,
}: {
  item: ReportExportHistoryOf<ReportExportsLedger>;
  onShowFailure: () => void;
}) {
  const { ready, expired, failed } = exportRowState(item);
  if (ready) {
    return (
      <span
        className={`${chipClassName} bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]`}
      >
        Ready
      </span>
    );
  }
  if (expired) {
    return (
      <span
        className={`${chipClassName} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`}
      >
        Expired
      </span>
    );
  }
  if (failed) {
    return (
      <button
        type="button"
        onClick={onShowFailure}
        className={`${chipClassName} bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]`}
      >
        Failed
      </button>
    );
  }
  return (
    <span
      className={`${chipClassName} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`}
    >
      {item.status === "CANCELLED" ? "Cancelled" : item.status}
    </span>
  );
}

function healthRailClassName(item: ReportExportHistoryOf<ReportExportsLedger>): string | null {
  const { ready, failed } = exportRowState(item);
  if (ready) return "bg-[var(--admin-success)]";
  if (failed) return "bg-[var(--admin-danger)]";
  return null;
}

export function ReportExportsPage<TPayload extends ReportExportsLedger>({
  api,
  layout = "page",
  breadcrumbs,
  description,
  tabs,
  columns,
  emptyHistoryText,
  search,
  pageSize,
  historyNote,
  footnote,
  renderNewExport,
}: ReportExportsPageProps<TPayload>) {
  type HistoryItem = ReportExportHistoryOf<TPayload>;

  const exports = useReportExports(api);
  const { payload, busyId } = exports;
  const [newExportOpen, setNewExportOpen] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<HistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const filteredHistory = useMemo(() => {
    const history = payload?.history ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (item) =>
        item.fileName.toLowerCase().includes(q) ||
        item.datasetLabel.toLowerCase().includes(q) ||
        item.scopeLabel.toLowerCase().includes(q),
    );
  }, [payload, searchQuery]);

  const totalHistory = filteredHistory.length;
  const totalHistoryPages = pageSize ? Math.max(1, Math.ceil(totalHistory / pageSize)) : 1;

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  const visibleHistory = useMemo(() => {
    if (!pageSize) return filteredHistory;
    const start = (historyPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, historyPage, pageSize]);

  const historyRangeLabel = useMemo(() => {
    if (!pageSize) return null;
    if (totalHistory === 0) return "Showing 0 of 0";
    const start = (historyPage - 1) * pageSize + 1;
    const end = Math.min(historyPage * pageSize, totalHistory);
    return `Showing ${start}-${end} of ${totalHistory}`;
  }, [historyPage, pageSize, totalHistory]);

  function openNewExport(preset: boolean) {
    setSchedulePreset(preset);
    setNewExportOpen(true);
  }

  async function retry(item: HistoryItem) {
    if (await exports.retry(item)) {
      setFailureItem(null);
      setHistoryPage(1);
    }
  }

  const panel = layout === "panel";

  if (exports.loading) {
    return <ExportsSkeleton padded={!panel} />;
  }

  if (!payload) {
    return (
      <div
        className={
          panel
            ? "flex flex-col items-center gap-4 py-8"
            : "mx-auto flex w-full max-w-[1600px] flex-col items-center gap-4 p-8"
        }
      >
        <p className="text-sm text-[var(--admin-danger)]" role="alert">
          {exports.error ?? "Could not load exports."}
        </p>
        <button
          type="button"
          onClick={() => void exports.load()}
          className={`${primaryButtonClassName} h-10 gap-2`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const TitleHeading = panel ? "h2" : "h1";
  const SectionHeading = panel ? "h3" : "h2";
  const CardHeading = panel ? "h4" : "h3";
  const columnCount = columns.length + 2;

  return (
    <div
      className={
        panel
          ? "flex flex-col gap-6"
          : "mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-8"
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {breadcrumbs ? (
            <nav className="mb-2 flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              {breadcrumbs.map((crumb) => (
                <Fragment key={crumb.label}>
                  <Link href={crumb.href} className="hover:text-[var(--admin-primary)]">
                    {crumb.label}
                  </Link>
                  <span aria-hidden="true">/</span>
                </Fragment>
              ))}
              <span className="font-medium text-[var(--admin-on-surface)]">Exports</span>
            </nav>
          ) : null}
          <TitleHeading className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Exports
          </TitleHeading>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void exports.load()}
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

      {tabs}

      {exports.error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          <span>{exports.error}</span>
          <button
            type="button"
            onClick={() => void exports.load()}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {search ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setHistoryPage(1);
            }}
            placeholder={search.placeholder}
            aria-label="Search export history"
            className="h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] pr-3 pl-9 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-8">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <SectionHeading className="text-base font-semibold text-[var(--admin-on-surface)]">
              Export history
            </SectionHeading>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  {[...columns.map((column) => column.heading), "Status", "Action"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                          heading === "Action" ? "text-right" : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {visibleHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columnCount}
                      className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    >
                      {searchQuery.trim() ? "No exports match your search." : emptyHistoryText}
                    </td>
                  </tr>
                ) : (
                  visibleHistory.map((item) => {
                    const { building, ready, expired, failed } = exportRowState(item);
                    const rail = healthRailClassName(item);

                    return (
                      <tr
                        key={item.id}
                        className={`group relative transition-colors hover:bg-[var(--admin-surface-low)] ${
                          expired ? "opacity-60" : ""
                        }`}
                      >
                        {columns.map((column, index) => (
                          <td
                            key={column.heading}
                            className={
                              index === 0 ? `relative ${column.className}` : column.className
                            }
                          >
                            {index === 0 && rail ? (
                              <span
                                className={`absolute inset-y-0 left-0 w-1 ${rail}`}
                                aria-hidden="true"
                              />
                            ) : null}
                            {column.render(item)}
                          </td>
                        ))}
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
                              <StatusCell
                                item={item}
                                onShowFailure={() => {
                                  setFailureItem(item);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ready ? (
                                <button
                                  type="button"
                                  onClick={() => void exports.download(item)}
                                  disabled={busyId === item.id}
                                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-80"
                                >
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                  Download
                                </button>
                              ) : failed ? (
                                <button
                                  type="button"
                                  onClick={() => void retry(item)}
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
          {historyNote || historyRangeLabel ? (
            <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {historyNote ? (
                <p className="text-xs text-[var(--admin-on-surface-variant)]">{historyNote}</p>
              ) : null}
              {historyRangeLabel ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {historyRangeLabel}
                  </span>
                  {totalHistoryPages > 1 ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={historyPage <= 1}
                        onClick={() => {
                          setHistoryPage((page) => Math.max(1, page - 1));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={historyPage >= totalHistoryPages}
                        onClick={() => {
                          setHistoryPage((page) => Math.min(totalHistoryPages, page + 1));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 lg:col-span-4">
          <SectionHeading className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </SectionHeading>
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
                  <CardHeading className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
                    {schedule.name}
                  </CardHeading>
                  <span className="mt-1 inline-flex h-6 items-center rounded-sm bg-[var(--admin-surface-high)] px-2 text-[11px] font-semibold tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                    {schedule.datasetLabel}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={busyId === schedule.id}
                    onClick={() => void exports.deleteSchedule(schedule)}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <PolicyToggle
                    checked={schedule.isActive}
                    disabled={busyId === schedule.id}
                    onChange={() => void exports.toggleSchedule(schedule)}
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

      {footnote ? (
        <div className="flex items-start gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
            aria-hidden="true"
          />
          <span>{typeof footnote === "function" ? footnote(payload) : footnote}</span>
        </div>
      ) : null}

      {renderNewExport({
        open: newExportOpen,
        schedulePreset,
        payload,
        onClose: () => {
          setNewExportOpen(false);
        },
        onCreated: (run, schedule) => {
          exports.created(run, schedule);
          setHistoryPage(1);
        },
      })}

      {failureItem ? (
        <ExportFailureDrawer
          item={failureItem}
          busy={busyId === failureItem.id}
          onClose={() => {
            setFailureItem(null);
          }}
          onRetry={() => void retry(failureItem)}
        />
      ) : null}

      {exports.toastRun ? (
        <ExportReadyToast
          fileName={exports.toastRun.fileName}
          onDownload={() => {
            if (exports.toastRun) void exports.download(exports.toastRun);
          }}
          onDismiss={exports.dismissToast}
        />
      ) : null}
    </div>
  );
}
