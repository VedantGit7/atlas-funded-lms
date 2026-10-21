"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  DirectExportPage,
  directExportCardClassName,
  directExportCardLabelClassName,
  directExportLabelClassName,
  useDirectExport,
  type DirectExportChip,
} from "./direct-export-kit";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import { AttributionErrorState } from "./AttributionStates";
import {
  ATTRIBUTION_EXPORT_AXIS,
  attributionLogFilters,
  readAttributionLogFields,
  type AttributionSummary,
  fetchAttributionEventsExport,
  fetchAttributionSummary,
  type AttributionFilters,
  type AttributionPresence,
} from "./attribution-api";
import {
  ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS,
  ATTRIBUTION_EXPORT_COLUMNS,
  attributionEventsToCsv,
  attributionExportFilename,
  attributionFieldClassName,
  dateInputToIso,
  formatRevenueFor,
  type AttributionExportColumnKey,
} from "./attribution-shared";
import { useViewerLocale, withViewer } from "./viewer-time";

/**
 * `/admin/reports/sales-marketing/attribution/exports`: the filtered
 * attribution log as a CSV, now (see direct-export-kit). The scheduled version
 * is the Attribution events dataset on Sales & Marketing exports.
 */

const SM_EXPORTS_HREF = "/admin/reports/sales-marketing/exports";
const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";

const ATTRIBUTION_FILTERS: Array<{ value: AttributionPresence; label: string }> = [
  { value: "any", label: "Any attribution" },
  { value: "attributed", label: "Has UTM" },
  { value: "none", label: "No UTM at all" },
];

/** The five UTM fields plus the timestamp: what a campaign analysis needs, without the learner columns. */
const ATTRIBUTION_ONLY_COLUMNS: AttributionExportColumnKey[] = [
  "occurredAt",
  "eventType",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "attributed",
];

export function AdminAttributionExportsPage({
  initialSummary,
}: {
  /** The count for the filters in the address, loaded by the server; the first browser load is skipped when present. */
  initialSummary?: ReportInitialData<AttributionSummary> | null;
} = {}) {
  const viewer = useViewerLocale();
  const formatRevenue = withViewer(formatRevenueFor, viewer);
  const searchParams = useSearchParams();

  // Seeded from the URL so "Export CSV" on the log arrives here already
  // describing the same set of events the operator was looking at. Read the
  // way the server reads them, and once, like the server's count.
  const [seed] = useState(() => readAttributionLogFields((name) => searchParams.get(name)));
  const [initial] = useState(() => initialSummary ?? null);
  const [eventType, setEventType] = useState(seed.eventType);
  const [attribution, setAttribution] = useState<AttributionPresence>(seed.attribution);
  const [query, setQuery] = useState(seed.query);
  const [fromDate, setFromDate] = useState(seed.fromDate);
  const [toDate, setToDate] = useState(seed.toDate);

  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);

  // The export narrows by no UTM axis, whatever the address says.
  const filters: AttributionFilters = useMemo(
    () =>
      attributionLogFilters(
        { query, eventType, attribution, axis: ATTRIBUTION_EXPORT_AXIS },
        dateInputToIso(fromDate, "start"),
        dateInputToIso(toDate, "end"),
      ),
    [query, eventType, attribution, fromDate, toDate],
  );

  const exportState = useDirectExport({
    filters,
    fetchSummary: fetchAttributionSummary,
    fetchExport: fetchAttributionEventsExport,
    allColumns: ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS,
    toCsv: attributionEventsToCsv,
    filename: attributionExportFilename({
      ...(eventType ? { eventType } : {}),
      attribution,
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
    }),
    noun: { one: "event", many: "events" },
    narrow: "the date range",
    summaryErrorMessage: "The event count could not be read.",
    initial,
  });
  const { summary } = exportState;

  const activeAttributionLabel =
    ATTRIBUTION_FILTERS.find((entry) => entry.value === attribution)?.label ?? "Any attribution";

  const chips: DirectExportChip[] = [
    ...(eventType
      ? [
          {
            key: "eventType",
            label: <>Type: {eventType}</>,
            removeLabel: "Remove event type filter",
            onRemove: () => {
              setEventType("");
            },
          },
        ]
      : []),
    ...(attribution !== "any"
      ? [
          {
            key: "attribution",
            label: activeAttributionLabel,
            removeLabel: "Remove attribution filter",
            onRemove: () => {
              setAttribution("any");
            },
          },
        ]
      : []),
    ...(fromDate || toDate
      ? [
          {
            key: "dates",
            label: (
              <>
                {fromDate || "start"} → {toDate || "now"}
              </>
            ),
            removeLabel: "Remove date filter",
            onRemove: () => {
              setFromDate("");
              setToDate("");
            },
          },
        ]
      : []),
    ...(query.trim()
      ? [
          {
            key: "q",
            label: <>Matching “{query.trim()}”</>,
            removeLabel: "Remove search filter",
            onRemove: () => {
              setQuery("");
            },
          },
        ]
      : []),
  ];

  return (
    <DirectExportPage
      state={exportState}
      tabs={<SalesMarketingReportTabs active="attribution" />}
      back={{ href: ATTRIBUTION_HREF, label: "Attribution events", returnLabel: "Back to the log" }}
      title="Export attribution events"
      description="A CSV of every event matching the filters below, not just the rows the log has loaded."
      scheduleNote={
        <>
          This downloads immediately in your browser. To schedule the same export to run daily,
          weekly or monthly and be emailed out, use{" "}
          <Link
            href={SM_EXPORTS_HREF}
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Sales &amp; marketing exports
          </Link>{" "}
          and pick the Attribution events dataset.
        </>
      }
      renderError={(props) => <AttributionErrorState {...props} />}
      scope={{
        title: "Which events",
        description: "The same filters as the log. Leave them all clear to export the whole log.",
        everythingLabel: "The entire log",
        chips,
        onClearAll: () => {
          setEventType("");
          setAttribution("any");
          setQuery("");
          setFromDate("");
          setToDate("");
        },
        fields: (
          <>
            <div className="min-w-[220px] flex-1">
              <label className={directExportLabelClassName} htmlFor="export-search">
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
                  <span className={directExportLabelClassName} id="export-event-type-label">
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
                  {/* Offered from the event types the log actually holds, so an
                      export can never be scoped to a type that has never been
                      recorded. */}
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
                        {entry.total.toLocaleString(viewer.locale)}
                      </span>
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="w-48">
              <DropdownField
                label={
                  <span className={directExportLabelClassName} id="export-attribution-label">
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
              <label className={directExportLabelClassName} htmlFor="export-from">
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
              <label className={directExportLabelClassName} htmlFor="export-to">
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
          </>
        ),
      }}
      columnOptions={ATTRIBUTION_EXPORT_COLUMNS}
      columnPreset={{ label: "Attribution only", columns: ATTRIBUTION_ONLY_COLUMNS }}
      rowCount={summary?.total ?? null}
      rowCountHint="Counted across the whole log for these filters, not the page you came from."
      detail={
        summary !== null && summary.total > 0 ? (
          <div className={directExportCardClassName}>
            <span className={directExportCardLabelClassName}>Of which</span>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-[var(--admin-on-surface)]">Carrying attribution</span>
                <span className="font-data tabular-nums text-[var(--admin-on-surface-variant)]">
                  {summary.attributed.toLocaleString(viewer.locale)}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-[var(--admin-on-surface)]">No UTM at all</span>
                <span className="font-data tabular-nums text-[var(--admin-on-surface-variant)]">
                  {summary.noUtm.toLocaleString(viewer.locale)}
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
                    {entry.events.toLocaleString(viewer.locale)}{" "}
                    {entry.events === 1 ? "event" : "events"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      }
    />
  );
}
