"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Hourglass,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import type {
  ReportExportHistoryOf,
  ReportExportScheduleOf,
  ReportExportsApi,
  ReportExportsLedger,
} from "./admin-report-exports-api";
import {
  InsightExportsSkeleton,
  InsightFailurePopover,
  InsightReadyToast,
  InsightScheduleMenu,
  insightDatasetChipClassName,
  insightFormatChipClassName,
  insightStatusLabel,
  insightStatusPillClassName,
  type InsightExportColumn,
} from "./insight-report-exports-kit";
import { PolicyToggle } from "./report-exports-kit";
import type { NewExportSlot } from "./ReportExportsPage";
import { useReportExports } from "./use-report-exports";

export type InsightReportExportsPageProps<TPayload extends ReportExportsLedger> = {
  api: ReportExportsApi<TPayload>;
  /** "panel" sits inside another page's header, one heading level down. */
  layout?: "page" | "panel";
  /** Links before the current "Exports" crumb. */
  breadcrumbs?: Array<{ label: string; href: string }>;
  description: string;
  tabs?: ReactNode;
  /** Shown above the history and schedules, given the payload and the page's reload and error banner. */
  banner?: (
    payload: TPayload,
    actions: { reload: () => Promise<void>; showError: (message: string) => void },
  ) => ReactNode;
  columns: InsightExportColumn[];
  emptyHistoryText: string;
  /** Pages the history this many rows at a time. */
  pageSize?: number;
  /** The line under the history table, fixed or read from the payload. */
  historyNote: string | ((payload: TPayload) => string);
  /** Expired files offer a re-run instead of a disabled download. */
  rerunExpired?: boolean;
  /** A failed export in another format can be retried as CSV. */
  retryAsCsv?: boolean;
  renderNewExport: (slot: NewExportSlot<TPayload>) => ReactNode;
};

const TOAST_DISMISS_MS = 8000;

/**
 * The insights look for a report's exports page: history with status pills and
 * a build line under running rows, schedule cards with a Run now menu, and a
 * ready toast that hides itself.
 */
export function InsightReportExportsPage<TPayload extends ReportExportsLedger>({
  api,
  layout = "page",
  breadcrumbs,
  description,
  tabs,
  banner,
  columns,
  emptyHistoryText,
  pageSize,
  historyNote,
  rerunExpired = false,
  retryAsCsv = false,
  renderNewExport,
}: InsightReportExportsPageProps<TPayload>) {
  type HistoryItem = ReportExportHistoryOf<TPayload>;
  type ScheduleItem = ReportExportScheduleOf<TPayload>;

  const exports = useReportExports(api, { toastDismissMs: TOAST_DISMISS_MS });
  const { payload, busyId } = exports;
  const [newExportOpen, setNewExportOpen] = useState(false);
  const [schedulePreset, setSchedulePreset] = useState(false);
  const [failureItem, setFailureItem] = useState<HistoryItem | null>(null);
  const [page, setPage] = useState(0);

  const history = useMemo(() => payload?.history ?? [], [payload]);
  const totalPages = pageSize ? Math.max(1, Math.ceil(history.length / pageSize)) : 1;

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const visibleHistory = useMemo(
    () => (pageSize ? history.slice(page * pageSize, (page + 1) * pageSize) : history),
    [history, page, pageSize],
  );

  function openNewExport(preset: boolean) {
    setSchedulePreset(preset);
    setNewExportOpen(true);
  }

  async function retry(item: HistoryItem, format?: "csv") {
    if (await exports.retry(item, format ? { format } : undefined)) {
      setFailureItem(null);
      setPage(0);
    }
  }

  async function runNow(schedule: ScheduleItem) {
    if (await exports.runScheduleNow(schedule)) setPage(0);
  }

  const panel = layout === "panel";

  if (exports.loading) {
    return <InsightExportsSkeleton padded={!panel} />;
  }

  if (!payload) {
    return (
      <div
        className={
          panel
            ? "flex flex-col items-center gap-4 py-8"
            : "mx-auto flex w-full max-w-[1440px] flex-col items-center gap-4 p-8"
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
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const TitleHeading = panel ? "h2" : "h1";
  const SectionHeading = panel ? "h3" : "h2";
  const CardHeading = panel ? "h4" : "h3";
  const headings = [...columns, { heading: "Status" }, { heading: "Action", align: "right" }];
  const note = typeof historyNote === "function" ? historyNote(payload) : historyNote;

  return (
    <div
      className={
        panel
          ? "flex flex-col gap-6"
          : "mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8"
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
            className={`${ghostButtonClassName} h-11 gap-2`}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              openNewExport(false);
            }}
            className={`${primaryButtonClassName} h-11 gap-2`}
          >
            <Plus className="h-4 w-4" />
            New export
          </button>
        </div>
      </div>

      {tabs}

      {exports.error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          <span>{exports.error}</span>
          <button
            type="button"
            onClick={() => void exports.load({ soft: true })}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      {banner?.(payload, {
        reload: () => exports.load({ soft: true }),
        showError: exports.setError,
      })}

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 flex flex-col gap-4 lg:col-span-8">
          <SectionHeading className="text-base font-semibold text-[var(--admin-on-surface)]">
            Export history
          </SectionHeading>
          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    {headings.map((column) => (
                      <th
                        key={column.heading}
                        className={`h-11 px-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                          "align" in column && column.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {column.heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {visibleHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={headings.length}
                        className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        {emptyHistoryText}
                      </td>
                    </tr>
                  ) : (
                    visibleHistory.map((item) => {
                      const building = item.status === "QUEUED" || item.status === "RUNNING";
                      const ready = item.status === "SUCCEEDED" && !item.expired;
                      const expired = item.status === "SUCCEEDED" && item.expired;
                      const failed = item.status === "FAILED";
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
                            expired ? "bg-[var(--admin-surface-low)] opacity-75" : ""
                          }`}
                        >
                          {columns.map((column) => (
                            <td key={column.heading} className={column.className}>
                              {column.render(item)}
                            </td>
                          ))}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={!failed}
                              title={
                                failed
                                  ? (item.errorMessage ?? item.errorCode ?? undefined)
                                  : undefined
                              }
                              onClick={() => {
                                if (failed) setFailureItem(item);
                              }}
                              className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide uppercase ${insightStatusPillClassName(item)} ${
                                failed ? "cursor-help" : ""
                              }`}
                            >
                              {insightStatusLabel(item)}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {ready ? (
                              <button
                                type="button"
                                aria-label={`Download ${item.fileName}`}
                                disabled={busyId === item.id}
                                onClick={() => void exports.download(item)}
                                className="inline-flex items-center justify-center text-[var(--admin-primary-strong)] transition-transform hover:opacity-80 active:translate-y-px disabled:opacity-50"
                              >
                                {busyId === item.id ? (
                                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                                ) : (
                                  <Download className="h-[18px] w-[18px]" />
                                )}
                              </button>
                            ) : failed || (expired && rerunExpired) ? (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void retry(item)}
                                className="text-[12px] font-semibold text-[var(--admin-primary-strong)] hover:underline disabled:opacity-50"
                              >
                                {failed ? "Retry" : "Re-run"}
                              </button>
                            ) : expired ? (
                              <Ban
                                className="ml-auto h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]"
                                aria-label="Expired"
                              />
                            ) : item.status === "QUEUED" ? (
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
            {pageSize && totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2">
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {history.length.toLocaleString()} exports
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
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">{note}</span>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-12 flex flex-col gap-4 lg:col-span-4">
          <SectionHeading className="text-base font-semibold text-[var(--admin-on-surface)]">
            Scheduled exports
          </SectionHeading>
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
                  <CardHeading
                    className={`text-base font-semibold text-[var(--admin-on-surface)] ${
                      schedule.isActive ? "" : "line-through"
                    }`}
                  >
                    {schedule.name}
                  </CardHeading>
                  <InsightScheduleMenu
                    scheduleName={schedule.name}
                    busy={busyId === schedule.id}
                    onRunNow={() => void runNow(schedule)}
                    onDelete={() => void exports.deleteSchedule(schedule)}
                  />
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={insightDatasetChipClassName}>{schedule.datasetLabel}</span>
                  {schedule.formats[0] ? (
                    <span className={insightFormatChipClassName}>
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
                    onChange={() => void exports.toggleSchedule(schedule)}
                    label={`Toggle ${schedule.name}`}
                  />
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={() => {
              openNewExport(true);
            }}
            className="group flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-bg)] p-6 text-[var(--admin-on-surface-variant)] transition-all duration-200 hover:border-[var(--admin-primary-strong)] hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary-strong)]"
          >
            <Plus className="mb-2 h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="text-base font-semibold">New schedule</span>
          </button>
        </section>
      </div>

      {renderNewExport({
        open: newExportOpen,
        schedulePreset,
        payload,
        onClose: () => {
          setNewExportOpen(false);
        },
        onCreated: (run, schedule) => {
          exports.created(run, schedule);
          setPage(0);
        },
      })}

      {failureItem ? (
        <InsightFailurePopover
          item={failureItem}
          busy={busyId === failureItem.id}
          onClose={() => {
            setFailureItem(null);
          }}
          onRetry={() => void retry(failureItem)}
          onRetryAsCsv={retryAsCsv ? () => void retry(failureItem, "csv") : undefined}
        />
      ) : null}

      {exports.toastRun ? (
        <InsightReadyToast
          fileName={exports.toastRun.fileName}
          onDownload={() => {
            if (exports.toastRun) void exports.download(exports.toastRun);
          }}
        />
      ) : null}
    </div>
  );
}
