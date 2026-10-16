"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";

/*
 * The "export the filtered set now" pages (Payment orders, Attribution
 * events). A ledger's own Export button can only write out the rows it has
 * loaded, fifty at a time, so the file silently omits everything the operator
 * did not scroll to. These pages export the filtered set server side instead:
 * they state how many rows that is before anything downloads, build the CSV in
 * the browser from one capped read, and say so when the cap is reached.
 *
 * Each page supplies its filters, its summary card and its file; this kit owns
 * the rest. The scheduled, emailed versions live on the report's exports tab.
 */

/** One capped server read of the filtered set. */
export type DirectExportResult<TItem> = {
  items: TItem[];
  /** How many rows match the filters in the whole ledger. */
  totalCount: number;
  /** True when more rows match than this response carries. */
  truncated: boolean;
  limit: number;
};

export const directExportLabelClassName =
  "mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]";

export const directExportCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4";

export const directExportCardLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

const panelClassName =
  "admin-glass rounded-xl border border-[var(--admin-border)] p-5 motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const noteClassName =
  "flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4";

const chipClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 text-xs font-semibold text-[var(--admin-on-surface)]";

const cardValueClassName =
  "font-data mt-2 block text-2xl font-light tabular-nums text-[var(--admin-on-surface)]";

const checkboxClassName =
  "h-4 w-4 shrink-0 cursor-pointer accent-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]";

/**
 * The count for the current filters, the column choice and the download.
 * `filters` must be memoized: a new object reloads the count.
 */
export function useDirectExport<TFilters, TSummary, TItem, TColumn extends string>({
  filters,
  fetchSummary,
  fetchExport,
  allColumns,
  toCsv,
  filename,
  noun,
  narrow,
  summaryErrorMessage,
}: {
  filters: TFilters;
  fetchSummary: (filters: TFilters) => Promise<TSummary>;
  fetchExport: (filters: TFilters) => Promise<DirectExportResult<TItem>>;
  allColumns: readonly TColumn[];
  toCsv: (items: TItem[], columns: TColumn[]) => string;
  filename: string;
  /** What a row is, for the download notice: "order"/"orders". */
  noun: { one: string; many: string };
  /** What to narrow when the cap is reached: "the filters", "the date range". */
  narrow: string;
  summaryErrorMessage: string;
}) {
  const [columns, setColumns] = useState<Set<TColumn>>(() => new Set(allColumns));
  const [summary, setSummary] = useState<TSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(
    async (activeFilters: TFilters) => {
      const ticket = ++requestId.current;
      setLoading(true);
      try {
        const next = await fetchSummary(activeFilters);
        // A count for filters the operator has already changed would be worse
        // than no count: it would understate or overstate the file.
        if (ticket !== requestId.current) return;
        setSummary(next);
        setError(null);
      } catch (caught) {
        if (ticket !== requestId.current) return;
        setSummary(null);
        setError(caught instanceof ClientApiError ? caught.message : summaryErrorMessage);
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [fetchSummary, summaryErrorMessage],
  );

  useEffect(() => {
    void load(filters);
  }, [load, filters]);

  function toggleColumn(key: TColumn) {
    setColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    setNotice(null);
    try {
      const result = await fetchExport(filters);
      const csv = toCsv(result.items, [...columns]);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      // The count comes from the response rather than from the preview, because
      // the ledger can have moved between the two reads.
      setNotice(
        result.truncated
          ? `Downloaded the first ${String(result.items.length)} of ${String(result.totalCount)} matching ${noun.many}. The export ceiling is ${String(result.limit)} rows. Narrow ${narrow} and export again to cover the rest.`
          : `Downloaded ${String(result.items.length)} ${result.items.length === 1 ? noun.one : noun.many}.`,
      );
    } catch (caught) {
      setDownloadError(
        caught instanceof ClientApiError ? caught.message : "The export could not be generated.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return {
    summary,
    loading,
    error,
    reload: () => {
      void load(filters);
    },
    columns,
    setColumns,
    toggleColumn,
    filename,
    downloading,
    downloadError,
    notice,
    dismissNotice: () => {
      setNotice(null);
    },
    download,
  };
}

export type DirectExportState<TColumn extends string> = {
  loading: boolean;
  error: string | null;
  reload: () => void;
  columns: ReadonlySet<TColumn>;
  setColumns: (next: Set<TColumn>) => void;
  toggleColumn: (key: TColumn) => void;
  filename: string;
  downloading: boolean;
  downloadError: string | null;
  notice: string | null;
  dismissNotice: () => void;
  download: () => Promise<void>;
};

/** An active filter, shown as a removable chip under the filters. */
export type DirectExportChip = {
  key: string;
  label: ReactNode;
  removeLabel: string;
  onRemove: () => void;
};

export function DirectExportPage<TColumn extends string>({
  state,
  tabs,
  back,
  title,
  description,
  scheduleNote,
  renderError,
  scope,
  columnOptions,
  columnPreset,
  rowCount,
  rowCountHint,
  detail,
}: {
  state: DirectExportState<TColumn>;
  tabs: ReactNode;
  /** The ledger this page exports, linked above the title and below the button. */
  back: { href: string; label: string; returnLabel: string };
  title: string;
  description: string;
  /** Where the scheduled version of this export lives. */
  scheduleNote: ReactNode;
  renderError: (props: { message: string; retrying: boolean; onRetry: () => void }) => ReactNode;
  scope: {
    title: string;
    description: string;
    fields: ReactNode;
    chips: DirectExportChip[];
    /** The chip shown when no filter is set: "The entire ledger". */
    everythingLabel: string;
    onClearAll: () => void;
  };
  columnOptions: ReadonlyArray<{ key: TColumn; label: string }>;
  /** A second quick choice beside "Select all", such as "ID only". */
  columnPreset: { label: string; columns: readonly TColumn[] };
  rowCount: number | null;
  rowCountHint: string;
  /** What the file holds beyond its row count, or null when there is nothing to say. */
  detail: ReactNode;
}) {
  const selectedCount = columnOptions.filter((column) => state.columns.has(column.key)).length;

  return (
    <div className="space-y-5">
      {tabs}

      <div className="min-w-0">
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
        <h1 className={managePageTitleClassName}>{title}</h1>
        <p className={managePageDescClassName}>{description}</p>
      </div>

      <div className={noteClassName}>
        <CalendarClock
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">{scheduleNote}</p>
      </div>

      {state.error !== null ? (
        renderError({ message: state.error, retrying: state.loading, onRetry: state.reload })
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className={panelClassName}>
              <h2 className={panelTitleClassName}>{scope.title}</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {scope.description}
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">{scope.fields}</div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                  Exporting:
                </span>
                {scope.chips.length === 0 ? (
                  <span className={chipClassName}>{scope.everythingLabel}</span>
                ) : (
                  <>
                    {scope.chips.map((chip) => (
                      <span key={chip.key} className={chipClassName}>
                        {chip.label}
                        <button
                          type="button"
                          aria-label={chip.removeLabel}
                          onClick={chip.onRemove}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={scope.onClearAll}
                      className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className={panelClassName}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={panelTitleClassName}>Columns</h2>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Column order in the file is fixed, so deselecting one never reorders the rest.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      state.setColumns(new Set(columnOptions.map((column) => column.key)));
                    }}
                  >
                    Select all
                  </button>
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">·</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      state.setColumns(new Set(columnPreset.columns));
                    }}
                  >
                    {columnPreset.label}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {columnOptions.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] motion-safe:transition-colors hover:border-[var(--admin-outline)]"
                  >
                    <input
                      type="checkbox"
                      className={checkboxClassName}
                      checked={state.columns.has(column.key)}
                      onChange={() => {
                        state.toggleColumn(column.key);
                      }}
                    />
                    {column.label}
                  </label>
                ))}
              </div>

              {selectedCount === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[var(--admin-warning)]">
                  No columns selected. The export will fall back to all of them rather than write an
                  empty file.
                </p>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className={directExportCardClassName}>
              <span className={directExportCardLabelClassName}>Rows to export</span>
              <span className={cardValueClassName}>
                {state.loading ? (
                  <span className="inline-block h-7 w-20 rounded bg-[var(--admin-surface-high)] align-middle motion-safe:animate-pulse" />
                ) : (
                  (rowCount ?? 0).toLocaleString()
                )}
              </span>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{rowCountHint}</p>
            </div>

            {detail}

            <div className={directExportCardClassName}>
              <span className={directExportCardLabelClassName}>File</span>
              <p className="font-data mt-2 break-all text-sm text-[var(--admin-on-surface)]">
                {state.filename}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {selectedCount === 0
                  ? `${String(columnOptions.length)} columns`
                  : `${String(selectedCount)} of ${String(columnOptions.length)} columns`}
                , CSV
              </p>
            </div>

            <button
              type="button"
              className={`${managePrimaryButtonClassName} w-full justify-center`}
              disabled={state.loading || state.downloading || rowCount === 0}
              onClick={() => {
                void state.download();
              }}
            >
              {state.downloading ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {state.downloading ? "Preparing…" : "Download CSV"}
            </button>

            {rowCount === 0 && !state.loading ? (
              <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
                Nothing matches these filters, so there is no file to build.
              </p>
            ) : null}

            <Link
              href={back.href}
              className={`${manageSecondaryButtonClassName} w-full justify-center`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {back.returnLabel}
            </Link>
          </aside>
        </div>
      )}

      {state.downloadError !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-[var(--admin-danger)]">
            {state.downloadError}
          </span>
        </div>
      ) : null}

      {state.notice !== null ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          {/* A truncated export is reported here, in the same place a clean one
              is, because a file that quietly stops at the ceiling is how a
              reconciliation goes wrong months later. */}
          <FileSpreadsheet
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--admin-on-surface)]">{state.notice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-auto text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={state.dismissNotice}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
