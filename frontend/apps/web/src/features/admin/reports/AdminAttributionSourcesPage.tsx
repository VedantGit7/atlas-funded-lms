"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Download,
  Info,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import { AttributionEmptyState, AttributionErrorState } from "./AttributionStates";
import {
  ATTRIBUTION_DIMENSIONS,
  fetchAttributionBreakdown,
  type AttributionBreakdown,
  type AttributionDimension,
  type AttributionFilters,
  type AttributionGroup,
  type AttributionPresence,
} from "./attribution-api";
import {
  UNATTRIBUTED_LABEL,
  attributionBreakdownToCsv,
  attributionNoteClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  attributionTableHeadCellClassName,
  attributionTableShellClassName,
  dimensionLabel,
  formatRelative,
  formatRevenue,
  formatShare,
  formatTimestamp,
  isThinData,
  shareOfTotal,
  THIN_DATA_THRESHOLD,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution/sources`.
 *
 * The log grouped by source, medium or campaign. Every figure is a server-side
 * scan of the whole log: a breakdown assembled in the browser from a loaded
 * page ranks campaigns by whichever fifty events the screen happened to fetch,
 * and the ranking shifts as the operator scrolls — which is worse than no
 * ranking, because it looks authoritative either way.
 *
 * Campaign is a genuinely new axis. The summary scan behind the log's signal
 * band groups by event type, source and medium, so until this screen existed
 * nothing in the console could group by campaign at all.
 */

const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";
const MARKETING_INSIGHT_HREF = "/admin/insights/marketing-insight";

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const segmentedClassName =
  "inline-flex gap-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-1";

function segmentClassName(active: boolean): string {
  return [
    "rounded-lg px-4 py-1.5 text-sm font-semibold motion-safe:transition-colors",
    active
      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
  ].join(" ");
}

/**
 * The composition bar's tint for a rank.
 *
 * Steps of one token rather than a palette: a breakdown with fourteen sources
 * would otherwise need fourteen invented colours, and the ordering is already
 * carried by the table beneath it.
 */
function compositionTint(index: number, unattributed: boolean): string {
  if (unattributed) return "var(--admin-warning)";
  const mix = Math.max(28, 100 - index * 14);
  return `color-mix(in srgb, var(--admin-primary) ${String(mix)}%, var(--admin-surface))`;
}

function isPresence(value: string): value is AttributionPresence {
  return value === "any" || value === "attributed" || value === "none";
}

function isDimension(value: string): value is AttributionDimension {
  return (ATTRIBUTION_DIMENSIONS as readonly string[]).includes(value);
}

export function AdminAttributionSourcesPage() {
  const searchParams = useSearchParams();

  const [dimension, setDimension] = useState<AttributionDimension>(() => {
    const value = searchParams.get("dimension") ?? "source";
    return isDimension(value) ? value : "source";
  });

  // Filters ride in from the log, so the breakdown describes the same events
  // the operator was looking at rather than silently widening to everything.
  const filters: AttributionFilters = useMemo(() => {
    const attribution = searchParams.get("attribution") ?? "";
    const eventType = searchParams.get("eventType") ?? "";
    const q = searchParams.get("q") ?? "";
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    return {
      ...(q ? { q } : {}),
      ...(eventType ? { eventType } : {}),
      ...(isPresence(attribution) && attribution !== "any" ? { attribution } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  }, [searchParams]);

  const [data, setData] = useState<AttributionBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(
    async (active: AttributionFilters, axis: AttributionDimension, mode: "initial" | "refresh") => {
      const ticket = ++requestId.current;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const next = await fetchAttributionBreakdown(active, axis);
        // A breakdown for an axis the operator has already switched away from
        // would put the wrong ranking under the right heading.
        if (ticket !== requestId.current) return;
        setData(next);
        setError(null);
      } catch (caught) {
        if (ticket !== requestId.current) return;
        setData(null);
        setError(
          caught instanceof ClientApiError ? caught.message : "The breakdown could not be read.",
        );
      } finally {
        if (ticket === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void load(filters, dimension, "initial");
  }, [load, filters, dimension]);

  function exportBreakdown() {
    if (data === null) return;
    const csv = attributionBreakdownToCsv(data.dimension, data.groups, data.totalEvents);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attribution-by-${data.dimension}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const filtered = Object.keys(filters).length > 0;

  return (
    <div className="space-y-5">
      <SalesMarketingReportTabs active="attribution" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link
            href={ATTRIBUTION_HREF}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Attribution events
          </Link>
          <h1 className={managePageTitleClassName}>Source breakdown</h1>
          <p className={managePageDescClassName}>
            The whole log grouped by source, medium or campaign.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={loading || refreshing}
            onClick={() => {
              void load(filters, dimension, "refresh");
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={data === null || data.groups.length === 0}
            onClick={exportBreakdown}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link href={MARKETING_INSIGHT_HREF} className={manageSecondaryButtonClassName}>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Marketing Insight
          </Link>
        </div>
      </div>

      <div className={attributionNoteClassName}>
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {/* The honest version. Every figure below is a scan of the whole log,
              which is the only way a ranking means anything. */}
          Grouped across every matching event in the log, not the rows the event list happens to
          have loaded.{" "}
          {filtered
            ? "The filters you arrived with are applied."
            : "No filters applied — this is the entire log."}
        </p>
      </div>

      <div className={segmentedClassName}>
        {ATTRIBUTION_DIMENSIONS.map((axis) => (
          <button
            key={axis}
            type="button"
            aria-pressed={axis === dimension}
            className={segmentClassName(axis === dimension)}
            onClick={() => {
              setDimension(axis);
            }}
          >
            {dimensionLabel(axis)}
          </button>
        ))}
      </div>

      {error !== null ? (
        <AttributionErrorState
          message={error}
          retrying={refreshing}
          onRetry={() => {
            void load(filters, dimension, "refresh");
          }}
        />
      ) : loading ? (
        <BreakdownSkeleton />
      ) : data === null ? null : data.totalEvents === 0 ? (
        <AttributionEmptyState insightHref={MARKETING_INSIGHT_HREF} />
      ) : (
        <BreakdownBody data={data} filters={filters} />
      )}
    </div>
  );
}

function BreakdownBody({
  data,
  filters,
}: {
  data: AttributionBreakdown;
  filters: AttributionFilters;
}) {
  const thin = isThinData(data.totalEvents);

  return (
    <>
      {thin ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
              Too few events to rank confidently
            </h2>
            {/* The shares below are arithmetic, not evidence. Saying so is the
                difference between a caveat and a decision made on nine events. */}
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {data.totalEvents.toLocaleString()} matching{" "}
              {data.totalEvents === 1 ? "event" : "events"} — under {THIN_DATA_THRESHOLD}, a single
              new event can move every share below by several points. The counts are exact; the
              ranking is not yet meaningful.
            </p>
          </div>
        </div>
      ) : null}

      {data.revenueWithoutCurrency > 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {/* Amounts with no currency cannot join any total, so without this
                they would simply be missing from every revenue figure. */}
            <span className="font-semibold text-[var(--admin-on-surface)]">
              {data.revenueWithoutCurrency.toLocaleString()}
            </span>{" "}
            {data.revenueWithoutCurrency === 1 ? "event carries" : "events carry"} a revenue amount
            with no currency recorded. Those amounts are counted below but cannot be added to any
            currency total, so every revenue figure here understates by that much.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SignalCard label="Events" value={data.totalEvents} />
        <SignalCard label="Distinct sources" value={data.distinctSources} />
        <SignalCard label="Distinct mediums" value={data.distinctMediums} />
        <SignalCard label="Distinct campaigns" value={data.distinctCampaigns} />
        <SignalCard
          label="No UTM at all"
          value={data.noUtm}
          tone={data.noUtm > 0 ? "warning" : undefined}
        />
      </div>

      {data.firstOccurredAt !== null && data.lastOccurredAt !== null ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          Covering {formatTimestamp(data.firstOccurredAt)} to {formatTimestamp(data.lastOccurredAt)}
          .
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className={panelClassName}>
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
              <h2 className={panelTitleClassName}>
                Composition by {dimensionLabel(data.dimension).toLowerCase()}
              </h2>
              <CompositionBar data={data} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <tr>
                    <th className={attributionTableHeadCellClassName}>
                      {dimensionLabel(data.dimension)}
                    </th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Events</th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Share</th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>
                      Revenue events
                    </th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Revenue</th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>
                      First seen
                    </th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Last seen</th>
                    <th className={attributionTableHeadCellClassName}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((group) => (
                    <GroupRow
                      key={group.value ?? " null"}
                      group={group}
                      dimension={data.dimension}
                      totalEvents={data.totalEvents}
                      filters={filters}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {data.truncated ? (
              <p className="border-t border-[var(--admin-border)] px-5 py-3 text-sm font-semibold text-[var(--admin-warning)]">
                {/* Never let a capped list read as the whole axis. */}
                Showing the top {data.groups.length} of {data.groupTotal.toLocaleString()} distinct{" "}
                {dimensionLabel(data.dimension).toLowerCase()} values.
              </p>
            ) : null}
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Source / medium</h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {/* The reason a cross-tab earns its space here. */}
                Source and medium only mean something together — google / cpc and google / organic
                are different channels that a single-column table merges.
              </p>
            </div>
            <SourceMediumMatrix matrix={data.matrix} />
          </section>
        </aside>
      </div>
    </>
  );
}

function SignalCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | undefined;
}) {
  return (
    <div className={attributionSignalCardClassName}>
      <span className={attributionSignalLabelClassName}>{label}</span>
      <span
        className={`${attributionSignalValueClassName} ${
          tone === "warning" ? "text-[var(--admin-warning)]" : ""
        }`}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function CompositionBar({ data }: { data: AttributionBreakdown }) {
  const shown = data.groups.slice(0, 8);
  return (
    <div className="mt-3 space-y-2">
      <div
        className="flex h-4 w-full overflow-hidden rounded-full border border-[var(--admin-border)]"
        role="img"
        aria-label={`Composition by ${dimensionLabel(data.dimension).toLowerCase()}`}
      >
        {shown.map((group, index) => {
          const share = shareOfTotal(group.events, data.totalEvents) ?? 0;
          return (
            <div
              key={group.value ?? " null"}
              className="h-full"
              style={{
                width: `${String(share)}%`,
                backgroundColor: compositionTint(index, group.value === null),
              }}
              title={`${group.value ?? UNATTRIBUTED_LABEL}: ${group.events.toLocaleString()}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {shown.map((group, index) => (
          <span
            key={group.value ?? " null"}
            className="flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: compositionTint(index, group.value === null) }}
              aria-hidden="true"
            />
            {group.value ?? UNATTRIBUTED_LABEL}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The query parameter that narrows the log to exactly one axis. */
const AXIS_PARAM: Record<AttributionDimension, { value: string; unset: string }> = {
  source: { value: "utmSource", unset: "utmSourceUnset" },
  medium: { value: "utmMedium", unset: "utmMediumUnset" },
  campaign: { value: "utmCampaign", unset: "utmCampaignUnset" },
};

function GroupRow({
  group,
  dimension,
  totalEvents,
  filters,
}: {
  group: AttributionGroup;
  dimension: AttributionDimension;
  totalEvents: number;
  filters: AttributionFilters;
}) {
  const unattributed = group.value === null;
  const share = shareOfTotal(group.events, totalEvents);

  // Exact narrowing on this axis, so the events the link opens are precisely
  // the events the row counted. It used to be a text search across every UTM
  // field, which meant a source and a campaign sharing a name both matched.
  const axis = AXIS_PARAM[dimension];
  const params = new URLSearchParams();
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (unattributed) params.set(axis.unset, "true");
  else params.set(axis.value, group.value ?? "");

  return (
    <tr
      className={
        unattributed
          ? "border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)]"
          : "border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_65%,transparent)]"
      }
    >
      <td className="whitespace-nowrap px-4 py-2.5">
        {unattributed ? (
          <span className="font-data inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-warning)]">
            {UNATTRIBUTED_LABEL}
          </span>
        ) : (
          <span className="font-data text-sm text-[var(--admin-on-surface)]">{group.value}</span>
        )}
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-[var(--admin-on-surface)]">
        {group.events.toLocaleString()}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-[var(--admin-surface-high)] sm:block">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${String(share ?? 0)}%`,
                backgroundColor: unattributed ? "var(--admin-warning)" : "var(--admin-primary)",
              }}
            />
          </span>
          <span className="font-data text-sm tabular-nums text-[var(--admin-on-surface-variant)]">
            {formatShare(share)}
          </span>
        </div>
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-[var(--admin-on-surface)]">
        {group.revenueEvents.toLocaleString()}
      </td>
      <td className="px-4 py-2.5 text-right">
        {group.revenueByCurrency.length === 0 && group.revenueWithoutCurrency === 0 ? (
          <span className="text-sm text-[var(--admin-on-surface-variant)]">—</span>
        ) : (
          <div className="flex flex-col items-end">
            {/* One line per currency. Never summed together. */}
            {group.revenueByCurrency.map((entry) => (
              <span
                key={entry.currency}
                className="font-data text-sm tabular-nums text-[var(--admin-on-surface)]"
              >
                {formatRevenue(entry.amountCents, entry.currency)}
              </span>
            ))}
            {group.revenueWithoutCurrency > 0 ? (
              <span className="flex items-center gap-1 text-[11px] text-[var(--admin-warning)]">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {group.revenueWithoutCurrency} without currency
              </span>
            ) : null}
          </div>
        )}
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm text-[var(--admin-on-surface-variant)]">
        {formatTimestamp(group.firstSeen)}
      </td>
      <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm text-[var(--admin-on-surface-variant)]">
        {formatRelative(group.lastSeen)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        <Link
          href={`${ATTRIBUTION_HREF}?${params.toString()}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
        >
          Events
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

function SourceMediumMatrix({ matrix }: { matrix: AttributionBreakdown["matrix"] }) {
  const lookup = new Map(
    matrix.cells.map((cell) => [`${cell.source ?? " null"}|${cell.medium ?? " null"}`, cell.events]),
  );

  function cell(source: string | null, medium: string | null): number {
    return lookup.get(`${source ?? " null"}|${medium ?? " null"}`) ?? 0;
  }

  function rowTotal(source: string | null): number {
    return matrix.mediums.reduce((total, medium) => total + cell(source, medium), 0);
  }

  if (matrix.sources.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
        No source or medium was recorded on any matching event.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--admin-border)]">
              <th className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                <span className="sr-only">Source</span>
              </th>
              {matrix.mediums.map((medium) => (
                <th
                  key={medium ?? " null"}
                  className={`font-data px-2 py-2 text-center text-[11px] ${
                    medium === null
                      ? "text-[var(--admin-warning)]"
                      : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {medium ?? "(none)"}
                </th>
              ))}
              <th className="border-l border-[var(--admin-border)] py-2 pl-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.sources.map((source) => (
              <tr
                key={source ?? " null"}
                className="border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_60%,transparent)]"
              >
                <td
                  className={`font-data py-2 pr-3 text-xs ${
                    source === null
                      ? "text-[var(--admin-warning)]"
                      : "text-[var(--admin-on-surface)]"
                  }`}
                >
                  {source ?? UNATTRIBUTED_LABEL}
                </td>
                {matrix.mediums.map((medium) => {
                  const events = cell(source, medium);
                  return (
                    <td
                      key={medium ?? " null"}
                      className="font-data px-2 py-2 text-center text-sm tabular-nums"
                      style={
                        events > 0
                          ? {
                              backgroundColor:
                                "color-mix(in srgb, var(--admin-primary) 10%, transparent)",
                            }
                          : undefined
                      }
                    >
                      {/* An empty cell is a dash, not a zero: nothing was ever
                          recorded for this pairing. */}
                      {events === 0 ? (
                        <span className="text-[var(--admin-on-surface-variant)]">—</span>
                      ) : (
                        <span className="text-[var(--admin-on-surface)]">
                          {events.toLocaleString()}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="font-data border-l border-[var(--admin-border)] py-2 pl-2 text-right text-sm font-semibold tabular-nums text-[var(--admin-on-surface)]">
                  {rowTotal(source).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matrix.truncated ? (
        <p className="border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
          {/* The cross-tab shows the busiest values on each axis; the totals
              here are for the cells shown, not for the whole log. */}
          Showing the busiest sources and mediums only, so these totals cover the cells above rather
          than every event.
        </p>
      ) : null}
    </>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={attributionSignalCardClassName}>
            <div className="h-3 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={attributionTableShellClassName}>
            <div className="space-y-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
              <div className="h-4 w-44 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
              <div className="h-4 w-full rounded-full bg-[var(--admin-surface)] motion-safe:animate-pulse" />
            </div>
            {Array.from({ length: 6 }, (_, row) => (
              <div
                key={row}
                className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3"
              >
                <div
                  className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                  style={{ width: `${String(16 + ((row * 6) % 12))}%` }}
                />
                <div className="h-3.5 w-12 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                <div className="h-3.5 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                <div className="ml-auto h-3.5 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className={attributionTableShellClassName}>
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="h-4 w-32 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          </div>
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, row) => (
              <div
                key={row}
                className="h-6 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
