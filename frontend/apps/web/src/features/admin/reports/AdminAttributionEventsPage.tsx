"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Download,
  Info,
  Loader2,
  RotateCcw,
  Search,
  Settings,
  TrendingUp,
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
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import {
  AttributionEmptyState,
  AttributionErrorState,
  AttributionNoMatchState,
  AttributionSkeleton,
} from "./AttributionStates";
import {
  ATTRIBUTION_PAGE_SIZE,
  fetchAttributionEvents,
  fetchAttributionSummary,
  type AttributionEvent,
  type AttributionFilters,
  type AttributionPresence,
  type AttributionSummary,
} from "./attribution-api";
import {
  attributedPercent,
  attributionChipClassName,
  attributionFieldClassName,
  attributionNoteClassName,
  attributionRowClassName,
  attributionRowUnattributedClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  attributionTableHeadCellClassName,
  attributionTableShellClassName,
  attributionToolbarClassName,
  dateInputToIso,
  eventTypeChipClassName,
  fallbackAttributionLabel,
  formatRevenue,
  formatTimestamp,
  isAttributed,
  looksLikeBrokenTracking,
  sourceMediumLabel,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution`.
 *
 * The raw event log: every tracked event and the campaign it came from. Source,
 * medium and campaign rollups live in Marketing Insight; this screen exists for
 * the question a rollup cannot answer, which is whether the events arriving are
 * carrying attribution at all.
 *
 * Every figure in the signal band is a server-side total over the whole
 * filtered log. A band computed from the loaded page could only ever describe
 * the first fifty rows, and "8 events with no attribution" read as a
 * tenant-wide figure when it means "8 of the 50 I fetched" is precisely how a
 * tracking link that lost its query string goes unnoticed for a month.
 *
 * The log is append-only from this console. There is no manual entry: a
 * hand-written attribution event would corrupt the one record used to decide
 * which campaigns worked.
 */

const MARKETING_INSIGHT_HREF = "/admin/insights/marketing-insight";

/**
 * Exact narrowing on one UTM axis.
 *
 * Separate from the free-text search, which spans every UTM field — so
 * searching "google" also matches a campaign named google. These arrive from a
 * breakdown row and have to survive the trip, or the link opens the whole log
 * while claiming to show one campaign's events.
 */
type AxisFilter = {
  source: string;
  medium: string;
  campaign: string;
  sourceUnset: boolean;
  mediumUnset: boolean;
  campaignUnset: boolean;
};

const EMPTY_AXIS: AxisFilter = {
  source: "",
  medium: "",
  campaign: "",
  sourceUnset: false,
  mediumUnset: false,
  campaignUnset: false,
};

const AXIS_CHIPS = [
  { label: "Source", value: "source", unset: "sourceUnset" },
  { label: "Medium", value: "medium", unset: "mediumUnset" },
  { label: "Campaign", value: "campaign", unset: "campaignUnset" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: "source" | "medium" | "campaign";
  unset: "sourceUnset" | "mediumUnset" | "campaignUnset";
}>;

const ATTRIBUTION_FILTERS: Array<{ value: AttributionPresence; label: string }> = [
  { value: "any", label: "Any attribution" },
  { value: "attributed", label: "Has UTM" },
  { value: "none", label: "No UTM at all" },
];

export function AdminAttributionEventsPage() {
  const [events, setEvents] = useState<AttributionEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<AttributionSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeded from the URL. A breakdown row links here with an exact axis
  // narrowing, and a screen that ignored it would open the whole log while
  // claiming to show one campaign's events.
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") ?? "");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [eventType, setEventType] = useState(() => searchParams.get("eventType") ?? "");
  const [attribution, setAttribution] = useState<AttributionPresence>(() => {
    const value = searchParams.get("attribution") ?? "any";
    return value === "attributed" || value === "none" ? value : "any";
  });
  const [fromDate, setFromDate] = useState(() => searchParams.get("from")?.slice(0, 10) ?? "");
  const [toDate, setToDate] = useState(() => searchParams.get("to")?.slice(0, 10) ?? "");
  const [axis, setAxis] = useState<AxisFilter>(() => ({
    source: searchParams.get("utmSource") ?? "",
    medium: searchParams.get("utmMedium") ?? "",
    campaign: searchParams.get("utmCampaign") ?? "",
    sourceUnset: searchParams.get("utmSourceUnset") === "true",
    mediumUnset: searchParams.get("utmMediumUnset") === "true",
    campaignUnset: searchParams.get("utmCampaignUnset") === "true",
  }));
  const [eventTypeOpen, setEventTypeOpen] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);

  // Debounced so a typed search does not fire a request per keystroke against
  // a table the beacon is writing to.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

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
      ...(axis.source ? { utmSource: axis.source } : {}),
      ...(axis.medium ? { utmMedium: axis.medium } : {}),
      ...(axis.campaign ? { utmCampaign: axis.campaign } : {}),
      ...(axis.sourceUnset ? { utmSourceUnset: true } : {}),
      ...(axis.mediumUnset ? { utmMediumUnset: true } : {}),
      ...(axis.campaignUnset ? { utmCampaignUnset: true } : {}),
    };
  }, [query, eventType, attribution, fromDate, toDate, axis]);

  const requestId = useRef(0);

  const load = useCallback(async (active: AttributionFilters, mode: "initial" | "refresh") => {
    const ticket = ++requestId.current;
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const [page, totals] = await Promise.all([
        fetchAttributionEvents(active),
        fetchAttributionSummary(active),
      ]);
      // A response for filters the operator has already changed would put the
      // wrong totals above the right table.
      if (ticket !== requestId.current) return;
      setEvents(page.items);
      setNextCursor(page.pageInfo.nextCursor);
      setSummary(totals);
      setError(null);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setEvents([]);
      setSummary(null);
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not load attribution events.",
      );
    } finally {
      if (ticket === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(filters, "initial");
  }, [load, filters]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const page = await fetchAttributionEvents(filters, nextCursor);
      setEvents((previous) => [...previous, ...page.items]);
      setNextCursor(page.pageInfo.nextCursor);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not load more events.");
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setSearchInput("");
    setQuery("");
    setEventType("");
    setAttribution("any");
    setFromDate("");
    setToDate("");
    setAxis(EMPTY_AXIS);
  }

  function clearAxis(key: keyof AxisFilter) {
    setAxis((previous) => ({
      ...previous,
      [key]: typeof previous[key] === "boolean" ? false : "",
    }));
  }

  // Filters ride along so the export screen opens describing the same set of
  // events the operator is looking at.
  const breakdownHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.eventType) params.set("eventType", filters.eventType);
    if (filters.attribution) params.set("attribution", filters.attribution);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const search = params.toString();
    return search
      ? `/admin/reports/sales-marketing/attribution/sources?${search}`
      : "/admin/reports/sales-marketing/attribution/sources";
  }, [filters]);

  const exportsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.eventType) params.set("eventType", filters.eventType);
    if (filters.attribution) params.set("attribution", filters.attribution);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const search = params.toString();
    return search
      ? `/admin/reports/sales-marketing/attribution/exports?${search}`
      : "/admin/reports/sales-marketing/attribution/exports";
  }, [filters]);

  const filtered =
    query.trim() !== "" ||
    eventType !== "" ||
    attribution !== "any" ||
    fromDate !== "" ||
    toDate !== "" ||
    AXIS_CHIPS.some((chip) => axis[chip.value] !== "" || axis[chip.unset]);

  const percent = summary === null ? null : attributedPercent(summary.attributed, summary.total);
  const trackingLooksBroken =
    summary !== null && !filtered && looksLikeBrokenTracking(summary.noUtm, summary.total);

  const activeAttributionLabel =
    ATTRIBUTION_FILTERS.find((entry) => entry.value === attribution)?.label ?? "Any attribution";

  return (
    <div className="space-y-5">
      <SalesMarketingReportTabs active="attribution" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className={managePageTitleClassName}>Attribution events</h1>
          <p className={managePageDescClassName}>
            Every tracked event and the campaign it came from.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={loading || refreshing}
            onClick={() => {
              void load(filters, "refresh");
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          {/* The export screen rather than this page's rows: a click here
              used to write out only what had been loaded, so a filtered log of
              2,000 events produced a 50-row file that looked complete. */}
          <Link href={exportsHref} className={manageSecondaryButtonClassName}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Link>
          {/* The breakdown groups the whole log, so it answers the question this
              table cannot: which source, medium or campaign is actually
              carrying the volume. */}
          <Link href={breakdownHref} className={manageSecondaryButtonClassName}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Breakdown
          </Link>
          {/* The events that cannot be credited at all, including the partially
              attributed ones this table counts as attributed. */}
          <Link
            href="/admin/reports/sales-marketing/attribution/unattributed"
            className={manageSecondaryButtonClassName}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Unattributed
          </Link>
          <Link href={MARKETING_INSIGHT_HREF} className={manageSecondaryButtonClassName}>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Open Marketing Insight
          </Link>
          {/* Where the tracking that fills this log is configured, and what is
              fixed in code. Read-only. */}
          <Link
            href="/admin/reports/sales-marketing/attribution/settings"
            className={manageSecondaryButtonClassName}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
        </div>
      </div>

      <div className={attributionNoteClassName}>
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          This is the raw event log, written by the marketing integrations and the sales beacon.
          Source, medium and campaign rollups live in{" "}
          <Link
            href={MARKETING_INSIGHT_HREF}
            className="font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Marketing Insight
          </Link>
          . Events cannot be added or edited here.
        </p>
      </div>

      {trackingLooksBroken ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
              Most events are arriving with no attribution.
            </h2>
            {/* Deliberately hedged. Direct traffic legitimately carries no UTM,
                so this is a prompt to check, never a diagnosis. */}
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {/* `trackingLooksBroken` already proved the summary is loaded. */}
              {`${String(summary.noUtm)} of ${String(summary.total)} events carry none of the five UTM fields.`}{" "}
              Some of that is genuine direct traffic. A share this high can also mean campaign links
              are losing their query string before the beacon sees them —{" "}
              <Link
                href="/admin/reports/sales-marketing/attribution/health"
                className="font-semibold text-[var(--admin-primary)] hover:underline"
              >
                check whether it changed on a particular day
              </Link>{" "}
              before reading anything into the campaign rollups.
            </p>
          </div>
        </div>
      ) : null}

      {/* Every figure here is a server-side total for the active filters, not a
          count of the rows currently loaded. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>
            {filtered ? "Matching events" : "Events in log"}
          </span>
          <span className={attributionSignalValueClassName}>
            {loading ? (
              <span className="inline-block h-7 w-20 rounded bg-[var(--admin-surface-high)] align-middle motion-safe:animate-pulse" />
            ) : (
              (summary?.total ?? 0).toLocaleString()
            )}
          </span>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            {events.length} loaded on this screen
          </p>
        </div>

        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>Carrying attribution</span>
          <span
            className={`${attributionSignalValueClassName} ${
              percent !== null && percent >= 50 ? "text-[var(--admin-success)]" : ""
            }`}
          >
            {/* An empty log is not 0% attributed; it has no percentage. */}
            {percent === null ? "—" : `${String(percent)}%`}
          </span>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            {summary === null ? "—" : `${summary.attributed.toLocaleString()} events`}
          </p>
        </div>

        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>No UTM at all</span>
          <span
            className={`${attributionSignalValueClassName} ${
              summary !== null && summary.noUtm > 0 ? "text-[var(--admin-warning)]" : ""
            }`}
          >
            {summary === null ? "—" : summary.noUtm.toLocaleString()}
          </span>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            includes genuine direct traffic
          </p>
        </div>

        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>Revenue events</span>
          <span className={attributionSignalValueClassName}>
            {summary === null ? "—" : summary.revenueEvents.toLocaleString()}
          </span>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--admin-on-surface-variant)]">
            {/* One figure per currency, never a grand total. */}
            {summary?.revenueByCurrency.map((entry) => (
              <span key={entry.currency} className="font-data tabular-nums">
                {formatRevenue(entry.amountCents, entry.currency)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {summary !== null && summary.firstOccurredAt !== null && summary.lastOccurredAt !== null ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          {/* The window the figures actually describe, rather than a "Last 30
              days" label the query does not enforce. */}
          Covering {formatTimestamp(summary.firstOccurredAt)} to{" "}
          {formatTimestamp(summary.lastOccurredAt)}.
        </p>
      ) : null}

      <div className={attributionToolbarClassName}>
        <div className="relative min-w-[16rem] flex-1">
          <label
            className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
            htmlFor="attribution-search"
          >
            Search
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id="attribution-search"
            type="search"
            className={`${attributionFieldClassName} pl-9`}
            placeholder="Event type, source, medium or campaign"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
          />
        </div>

        <div className="w-48">
          <DropdownField
            label={
              <span
                className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                id="attribution-event-type-label"
              >
                Event type
              </span>
            }
            labelId="attribution-event-type"
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
              {/* Offered from the event types the log actually holds. This used
                  to be a free-text box matched exactly, so a typo returned an
                  empty table that looked like an absence of events. */}
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
              <span
                className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                id="attribution-presence-label"
              >
                Attribution
              </span>
            }
            labelId="attribution-presence"
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
          <label
            className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
            htmlFor="attribution-from"
          >
            From
          </label>
          <input
            id="attribution-from"
            type="date"
            className={attributionFieldClassName}
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
            }}
          />
        </div>

        <div className="w-40">
          <label
            className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
            htmlFor="attribution-to"
          >
            To
          </label>
          <input
            id="attribution-to"
            type="date"
            className={attributionFieldClassName}
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
            }}
          />
        </div>

        {filtered ? (
          <button
            type="button"
            onClick={clearFilters}
            className={`${attributionChipClassName} h-[38px]`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      {AXIS_CHIPS.some((chip) => axis[chip.value] !== "" || axis[chip.unset]) ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
            Exact match:
          </span>
          {/* Exact narrowing arrives from a breakdown row. It is shown as a
              removable chip rather than a control, because the value set is the
              whole log's and belongs on the breakdown screen. */}
          {AXIS_CHIPS.map((chip) => {
            const value = axis[chip.value];
            const unset = axis[chip.unset];
            if (value === "" && !unset) return null;
            return (
              <span key={chip.label} className={attributionChipClassName}>
                {chip.label}:{" "}
                {unset ? (
                  <span className="italic">not set</span>
                ) : (
                  <span className="font-data">{value}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={() => {
                    clearAxis(unset ? chip.unset : chip.value);
                  }}
                  className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {error !== null ? (
        <AttributionErrorState
          message={error}
          retrying={refreshing}
          onRetry={() => {
            void load(filters, "refresh");
          }}
        />
      ) : loading ? (
        <AttributionSkeleton />
      ) : events.length === 0 ? (
        filtered ? (
          <AttributionNoMatchState onClearFilters={clearFilters} />
        ) : (
          <AttributionEmptyState insightHref={MARKETING_INSIGHT_HREF} />
        )
      ) : (
        <>
          <div className={attributionTableShellClassName}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  <tr>
                    <th className={attributionTableHeadCellClassName}>Occurred</th>
                    <th className={attributionTableHeadCellClassName}>Event</th>
                    <th className={attributionTableHeadCellClassName}>Source / medium</th>
                    <th className={attributionTableHeadCellClassName}>Campaign</th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Revenue</th>
                    <th className={attributionTableHeadCellClassName}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <AttributionRow key={event.id} event={event} />
                  ))}
                </tbody>
              </table>
            </div>

            {nextCursor !== null ? (
              <div className="flex justify-center border-t border-[var(--admin-border)] p-4">
                <button
                  type="button"
                  className={manageSecondaryButtonClassName}
                  disabled={loadingMore}
                  onClick={() => {
                    void loadMore();
                  }}
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  ) : null}
                  {loadingMore ? "Loading…" : `Load ${ATTRIBUTION_PAGE_SIZE} more`}
                </button>
              </div>
            ) : null}
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Showing {events.length.toLocaleString()} of{" "}
            {(summary?.total ?? events.length).toLocaleString()} matching events.
          </p>
        </>
      )}
    </div>
  );
}

function AttributionRow({ event }: { event: AttributionEvent }) {
  const attributed = isAttributed(event);
  const fallback = fallbackAttributionLabel(event);
  const hasRevenue = event.revenueCents !== null;

  return (
    <tr className={attributed ? attributionRowClassName : attributionRowUnattributedClassName}>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)]">
        {formatTimestamp(event.occurredAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className={eventTypeChipClassName(hasRevenue)}>{event.eventType}</span>
      </td>
      {attributed ? (
        <>
          <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface)]">
            {sourceMediumLabel(event)}
          </td>
          <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface)]">
            {event.utmCampaign ??
              (fallback === null ? (
                <span className="italic text-[var(--admin-on-surface-variant)]">(not set)</span>
              ) : (
                // Attributed, but by a field this table has no column for.
                <span className="text-[var(--admin-on-surface-variant)]">{fallback}</span>
              ))}
          </td>
        </>
      ) : (
        // One statement spanning both columns rather than two "(not set)" cells:
        // nothing was captured, and the row should say so once.
        <td className="px-4 py-2.5 text-sm text-[var(--admin-warning)]" colSpan={2}>
          No attribution captured
        </td>
      )}
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-[var(--admin-on-surface)]">
        {formatRevenue(event.revenueCents, event.currency)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {/* The detail view carries the two UTM fields this row cannot, so a row
            reading as unattributed here may not be. */}
        <Link
          href={`/admin/reports/sales-marketing/attribution/${event.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
        >
          Open
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}
