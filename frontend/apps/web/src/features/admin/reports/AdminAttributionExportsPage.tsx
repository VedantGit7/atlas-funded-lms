"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import { AttributionErrorState } from "./AttributionStates";
import {
  fetchAttributionEventsExport,
  fetchAttributionSummary,
  type AttributionFilters,
  type AttributionPresence,
  type AttributionSummary,
} from "./attribution-api";
import {
  ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS,
  ATTRIBUTION_EXPORT_COLUMNS,
  attributionChipClassName,
  attributionEventsToCsv,
  attributionExportFilename,
  attributionFieldClassName,
  attributionNoteClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  dateInputToIso,
  formatRevenue,
  type AttributionExportColumnKey,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution/exports`.
 *
 * The log's own Export button can only write out the rows it has loaded — fifty
 * at a time — so exporting a quarter meant pressing "Load more" until the whole
 * quarter was in the browser, and the resulting file silently omitted
 * everything the operator had not scrolled to. This screen exports the filtered
 * set server side, states how many rows that is before anything downloads, and
 * refuses to be quiet about hitting its own ceiling.
 *
 * It is a one-shot download. The scheduled, emailed version lives on the Sales
 * & Marketing exports tab, where `attribution` is now a dataset of its own.
 */

const SM_EXPORTS_HREF = "/admin/reports/sales-marketing/exports";
const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";

const ATTRIBUTION_FILTERS: Array<{ value: AttributionPresence; label: string }> = [
  { value: "any", label: "Any attribution" },
  { value: "attributed", label: "Has UTM" },
  { value: "none", label: "No UTM at all" },
];

const panelClassName =
  "admin-glass rounded-xl border border-[var(--admin-border)] p-5 motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const labelClassName = "mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]";

function isPresence(value: string): value is AttributionPresence {
  return value === "any" || value === "attributed" || value === "none";
}

export function AdminAttributionExportsPage() {
  const searchParams = useSearchParams();

  // Seeded from the URL so "Export CSV" on the log arrives here already
  // describing the same set of events the operator was looking at.
  const [eventType, setEventType] = useState(() => searchParams.get("eventType") ?? "");
  const [attribution, setAttribution] = useState<AttributionPresence>(() => {
    const value = searchParams.get("attribution") ?? "any";
    return isPresence(value) ? value : "any";
  });
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [fromDate, setFromDate] = useState(() => searchParams.get("from")?.slice(0, 10) ?? "");
  const [toDate, setToDate] = useState(() => searchParams.get("to")?.slice(0, 10) ?? "");

  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);

  const [columns, setColumns] = useState<Set<AttributionExportColumnKey>>(
    () => new Set(ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS),
  );

  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filters: AttributionFilters = useMemo(() => {
    // Absent bounds are absent keys, not explicit undefined: the client turns
    // this object straight into query parameters.
    const from = dateInputToIso(fromDate, "start");
    const to = dateInputToIso(toDate, "end");
    return {
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(eventType ? { eventType } : {}),
      ...(attribution !== "any" ? { attribution } : {}),
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
    };
  }, [query, eventType, attribution, fromDate, toDate]);

  const requestId = useRef(0);

  const load = useCallback(async (active: AttributionFilters) => {
    const ticket = ++requestId.current;
    setLoading(true);
    try {
      const next = await fetchAttributionSummary(active);
      // A count for filters the operator has already changed would be worse
      // than no count: it would understate or overstate the file.
      if (ticket !== requestId.current) return;
      setSummary(next);
      setError(null);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setSummary(null);
      setError(
        caught instanceof ClientApiError ? caught.message : "The event count could not be read.",
      );
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [load, filters]);

  const selectedColumns = ATTRIBUTION_EXPORT_COLUMNS.filter((column) => columns.has(column.key));
  const filterCount = Object.keys(filters).length;
  const filename = attributionExportFilename({
    ...(eventType ? { eventType } : {}),
    attribution,
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(fromDate ? { from: fromDate } : {}),
    ...(toDate ? { to: toDate } : {}),
  });
  const rowCount = summary?.total ?? null;

  function toggleColumn(key: AttributionExportColumnKey) {
    setColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setEventType("");
    setAttribution("any");
    setQuery("");
    setFromDate("");
    setToDate("");
  }

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    setNotice(null);
    try {
      const result = await fetchAttributionEventsExport(filters);
      const csv = attributionEventsToCsv(result.items, [...columns]);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      // The count comes from the response rather than from the preview, because
      // the beacon can have written between the two reads.
      setNotice(
        result.truncated
          ? `Downloaded the first ${String(result.items.length)} of ${String(result.totalCount)} matching events — the export ceiling is ${String(result.limit)} rows. Narrow the date range and export again to cover the rest.`
          : `Downloaded ${String(result.items.length)} ${result.items.length === 1 ? "event" : "events"}.`,
      );
    } catch (caught) {
      setDownloadError(
        caught instanceof ClientApiError ? caught.message : "The export could not be generated.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const activeAttributionLabel =
    ATTRIBUTION_FILTERS.find((entry) => entry.value === attribution)?.label ?? "Any attribution";

  return (
    <div className="space-y-5">
      <SalesMarketingReportTabs active="attribution" />

      <div className="min-w-0">
        <Link
          href={ATTRIBUTION_HREF}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Attribution events
        </Link>
        <h1 className={managePageTitleClassName}>Export attribution events</h1>
        <p className={managePageDescClassName}>
          A CSV of every event matching the filters below — not just the rows the log has loaded.
        </p>
      </div>

      <div className={attributionNoteClassName}>
        <CalendarClock
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          This downloads immediately in your browser. To schedule the same export to run daily,
          weekly or monthly and be emailed out, use{" "}
          <Link
            href={SM_EXPORTS_HREF}
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Sales &amp; marketing exports
          </Link>{" "}
          and pick the Attribution events dataset.
        </p>
      </div>

      {error !== null ? (
        <AttributionErrorState
          message={error}
          retrying={loading}
          onRetry={() => {
            void load(filters);
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className={panelClassName}>
              <h2 className={panelTitleClassName}>Which events</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                The same filters as the log. Leave them all clear to export the whole log.
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className={labelClassName} htmlFor="export-search">
                    Search
                  </label>
                  <input
                    id="export-search"
                    type="search"
                    className={attributionFieldClassName}
                    placeholder="Event type, source, medium or campaign"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                    }}
                  />
                </div>

                <div className="w-48">
                  <DropdownField
                    label={
                      <span className={labelClassName} id="export-event-type-label">
                        Event type
                      </span>
                    }
                    labelId="export-event-type"
                    open={eventTypeOpen}
                    panelAriaLabel="Filter by event type"
                    onToggle={() => {
                      setEventTypeOpen((previous) => !previous);
                    }}
                    triggerContent={eventType === "" ? "All events" : eventType}
                  >
                    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1.5">
                      <button
                        type="button"
                        role="option"
                        aria-selected={eventType === ""}
                        className={dropdownItemClassName}
                        onClick={() => {
                          setEventType("");
                          setEventTypeOpen(false);
                        }}
                      >
                        All events
                      </button>
                      {/* Offered from the event types the log actually holds,
                          so an export can never be scoped to a type that has
                          never been recorded. */}
                      {summary?.eventTypes.map((entry) => (
                        <button
                          key={entry.eventType}
                          type="button"
                          role="option"
                          aria-selected={entry.eventType === eventType}
                          className={`${dropdownItemClassName} justify-between`}
                          onClick={() => {
                            setEventType(entry.eventType);
                            setEventTypeOpen(false);
                          }}
                        >
                          <span className="font-data">{entry.eventType}</span>
                          <span className="text-xs text-[var(--admin-on-surface-variant)]">
                            {entry.total.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="w-48">
                  <DropdownField
                    label={
                      <span className={labelClassName} id="export-attribution-label">
                        Attribution
                      </span>
                    }
                    labelId="export-attribution"
                    open={attributionOpen}
                    panelAriaLabel="Filter by attribution"
                    onToggle={() => {
                      setAttributionOpen((previous) => !previous);
                    }}
                    triggerContent={activeAttributionLabel}
                  >
                    <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                      {ATTRIBUTION_FILTERS.map((entry) => (
                        <button
                          key={entry.value}
                          type="button"
                          role="option"
                          aria-selected={entry.value === attribution}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setAttribution(entry.value);
                            setAttributionOpen(false);
                          }}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                </div>

                <div className="w-40">
                  <label className={labelClassName} htmlFor="export-from">
                    From
                  </label>
                  <input
                    id="export-from"
                    type="date"
                    className={attributionFieldClassName}
                    value={fromDate}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                    }}
                  />
                </div>

                <div className="w-40">
                  <label className={labelClassName} htmlFor="export-to">
                    To
                  </label>
                  <input
                    id="export-to"
                    type="date"
                    className={attributionFieldClassName}
                    value={toDate}
                    onChange={(event) => {
                      setToDate(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                  Exporting:
                </span>
                {filterCount === 0 ? (
                  <span className={attributionChipClassName}>The entire log</span>
                ) : (
                  <>
                    {eventType ? (
                      <span className={attributionChipClassName}>
                        Type: {eventType}
                        <button
                          type="button"
                          aria-label="Remove event type filter"
                          onClick={() => {
                            setEventType("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {attribution !== "any" ? (
                      <span className={attributionChipClassName}>
                        {activeAttributionLabel}
                        <button
                          type="button"
                          aria-label="Remove attribution filter"
                          onClick={() => {
                            setAttribution("any");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {fromDate || toDate ? (
                      <span className={attributionChipClassName}>
                        {fromDate || "start"} → {toDate || "now"}
                        <button
                          type="button"
                          aria-label="Remove date filter"
                          onClick={() => {
                            setFromDate("");
                            setToDate("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {query.trim() ? (
                      <span className={attributionChipClassName}>
                        Matching “{query.trim()}”
                        <button
                          type="button"
                          aria-label="Remove search filter"
                          onClick={() => {
                            setQuery("");
                          }}
                          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={clearFilters}
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
                      setColumns(new Set(ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS));
                    }}
                  >
                    Select all
                  </button>
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">·</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => {
                      // The five UTM fields plus the timestamp: what a campaign
                      // analysis actually needs, without the learner columns.
                      setColumns(
                        new Set<AttributionExportColumnKey>([
                          "occurredAt",
                          "eventType",
                          "utmSource",
                          "utmMedium",
                          "utmCampaign",
                          "utmTerm",
                          "utmContent",
                          "attributed",
                        ]),
                      );
                    }}
                  >
                    Attribution only
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ATTRIBUTION_EXPORT_COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] motion-safe:transition-colors hover:border-[var(--admin-outline)]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                      checked={columns.has(column.key)}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                    />
                    {column.label}
                  </label>
                ))}
              </div>

              {selectedColumns.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-[var(--admin-warning)]">
                  No columns selected — the export will fall back to all of them rather than write
                  an empty file.
                </p>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Rows to export</span>
              <span className={attributionSignalValueClassName}>
                {loading ? (
                  <span className="inline-block h-7 w-20 rounded bg-[var(--admin-surface-high)] align-middle motion-safe:animate-pulse" />
                ) : (
                  (rowCount ?? 0).toLocaleString()
                )}
              </span>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                Counted across the whole log for these filters, not the page you came from.
              </p>
            </div>

            {summary !== null && summary.total > 0 ? (
              <div className={attributionSignalCardClassName}>
                <span className={attributionSignalLabelClassName}>Of which</span>
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex items-baseline justify-between gap-3">
                    <span className="text-[var(--admin-on-surface)]">Carrying attribution</span>
                    <span className="font-data tabular-nums text-[var(--admin-on-surface-variant)]">
                      {summary.attributed.toLocaleString()}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-3">
                    <span className="text-[var(--admin-on-surface)]">No UTM at all</span>
                    <span className="font-data tabular-nums text-[var(--admin-on-surface-variant)]">
                      {summary.noUtm.toLocaleString()}
                    </span>
                  </li>
                  {/* One line per currency, never a grand total. */}
                  {summary.revenueByCurrency.map((entry) => (
                    <li
                      key={entry.currency}
                      className="flex items-baseline justify-between gap-3 border-t border-[var(--admin-border)] pt-1"
                    >
                      <span className="font-data tabular-nums text-[var(--admin-on-surface)]">
                        {formatRevenue(entry.amountCents, entry.currency)}
                      </span>
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        {entry.events.toLocaleString()} {entry.events === 1 ? "event" : "events"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>File</span>
              <p className="font-data mt-2 break-all text-sm text-[var(--admin-on-surface)]">
                {filename}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {selectedColumns.length === 0
                  ? `${String(ATTRIBUTION_EXPORT_COLUMNS.length)} columns`
                  : `${String(selectedColumns.length)} of ${String(ATTRIBUTION_EXPORT_COLUMNS.length)} columns`}
                , CSV
              </p>
            </div>

            <button
              type="button"
              className={`${managePrimaryButtonClassName} w-full justify-center`}
              disabled={loading || downloading || rowCount === 0}
              onClick={() => {
                void download();
              }}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {downloading ? "Preparing…" : "Download CSV"}
            </button>

            {rowCount === 0 && !loading ? (
              <p className="text-center text-xs text-[var(--admin-on-surface-variant)]">
                Nothing matches these filters, so there is no file to build.
              </p>
            ) : null}

            <Link
              href={ATTRIBUTION_HREF}
              className={`${manageSecondaryButtonClassName} w-full justify-center`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the log
            </Link>
          </aside>
        </div>
      )}

      {downloadError !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-[var(--admin-danger)]">{downloadError}</span>
        </div>
      ) : null}

      {notice !== null ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          {/* A truncated export is reported here, in the same place a clean one
              is, because a file that quietly stops at the ceiling is how a
              campaign analysis goes wrong months later. */}
          <FileSpreadsheet
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--admin-on-surface)]">{notice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-auto text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={() => {
              setNotice(null);
            }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
