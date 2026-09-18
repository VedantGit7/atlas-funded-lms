import { csvRow } from "../../../lib/export/csv";
import type {
  AttributionAnomalyKind,
  AttributionDimension,
  AttributionGapKind,
  AttributionEvent,
  AttributionGroup,
} from "./attribution-api";

/**
 * Presentation vocabulary for the attribution event log.
 *
 * Every surface resolves through `--admin-*` tokens so the log renders in both
 * themes, and every derived figure lives here rather than inline — on a screen
 * whose whole job is telling "no campaign" apart from "no tracking", the
 * difference between an absent value and a captured one is the point.
 */

export const attributionNoteClassName =
  "flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4";

export const attributionSignalCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4";

export const attributionSignalLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const attributionSignalValueClassName =
  "font-data mt-2 block text-2xl font-light tabular-nums text-[var(--admin-on-surface)]";

export const attributionToolbarClassName =
  "flex flex-wrap items-end gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3";

export const attributionTableShellClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)]";

export const attributionTableHeadCellClassName =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const attributionRowClassName =
  "border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_65%,transparent)]";

/**
 * A row with no attribution is tinted warm, never red.
 *
 * An untracked visit is not an error — somebody typing the address in produces
 * exactly this row. The tint marks it as worth noticing in bulk, which is the
 * only scale at which it means anything.
 */
export const attributionRowUnattributedClassName =
  "border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)]";

export const attributionFieldClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const attributionChipClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 text-xs font-semibold text-[var(--admin-on-surface)]";

/** Event types are gateway- and beacon-supplied strings, so the pill is neutral. */
export function eventTypeChipClassName(isRevenue: boolean): string {
  const base =
    "font-data inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (isRevenue) {
    return `${base} border-[color-mix(in_srgb,var(--admin-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]`;
  }
  return `${base} border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
}

/**
 * Every UTM field, in the order a link carries them.
 *
 * All five, always — an absent field is shown as absent rather than omitted, so
 * "no campaign" and "field not returned by the API" stop looking the same.
 */
export function utmFields(
  event: Pick<
    AttributionEvent,
    "utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent"
  >,
): Array<{ key: string; value: string | null }> {
  return [
    { key: "utm_source", value: event.utmSource },
    { key: "utm_medium", value: event.utmMedium },
    { key: "utm_campaign", value: event.utmCampaign },
    { key: "utm_term", value: event.utmTerm },
    { key: "utm_content", value: event.utmContent },
  ];
}

/**
 * Whether the event carried any campaign attribution.
 *
 * Exactly the server's predicate now that the list carries all five fields.
 * It used to see only three, so a row attributed solely by `utm_term` or
 * `utm_content` was tinted as unattributed, exported as `attributed: no`, and
 * counted as attributed by the signal band above it — three surfaces, two
 * answers.
 */
export function isAttributed(
  event: Pick<
    AttributionEvent,
    "utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent"
  >,
): boolean {
  return utmFields(event).some((field) => field.value !== null);
}

/**
 * The field that attributed an event when the usual three are empty.
 *
 * Without this a row attributed solely by `utm_term` renders "(not set)" in
 * every visible cell while being tinted as attributed — accurate, and baffling.
 */
export function fallbackAttributionLabel(
  event: Pick<
    AttributionEvent,
    "utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent"
  >,
): string | null {
  if (event.utmSource !== null || event.utmMedium !== null || event.utmCampaign !== null) {
    return null;
  }
  if (event.utmTerm !== null) return `utm_term: ${event.utmTerm}`;
  if (event.utmContent !== null) return `utm_content: ${event.utmContent}`;
  return null;
}

/** Source and medium as one cell, the way analytics tools read them. */
export function sourceMediumLabel(event: AttributionEvent): string {
  const source = event.utmSource ?? "(not set)";
  const medium = event.utmMedium ?? "(not set)";
  return `${source} / ${medium}`;
}

/**
 * Revenue, from minor units, in the event's own currency.
 *
 * An event with no revenue is not zero revenue — a page view has no amount at
 * all — so the absence is preserved rather than formatted as 0.00.
 */
export function formatRevenue(cents: number | null, currency: string | null): string {
  if (cents === null) return "—";
  const amount = cents / 100;
  if (currency === null) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    // An unrecognised currency code must not blank the cell or throw.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A whole-day boundary, for the date inputs. `""` means no bound. */
export function dateInputToIso(value: string, edge: "start" | "end"): string | undefined {
  if (value.trim() === "") return undefined;
  const date = new Date(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Percentage of events that carried attribution; an empty log is not 0%. */
export function attributedPercent(attributed: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((attributed / total) * 100);
}

/**
 * Whether the log looks like tracking is broken rather than merely quiet.
 *
 * A handful of direct visits is normal and always will be. What is not normal
 * is most events arriving with nothing attached — that is what a tracking link
 * that lost its query string looks like. The floor exists because three events
 * out of four proves nothing.
 */
export const TRACKING_ALERT_MIN_EVENTS = 20;
export const TRACKING_ALERT_THRESHOLD = 0.5;

export function looksLikeBrokenTracking(noUtm: number, total: number): boolean {
  if (total < TRACKING_ALERT_MIN_EVENTS) return false;
  return noUtm / total > TRACKING_ALERT_THRESHOLD;
}

/**
 * CSV of the loaded events.
 *
 * Through the shared escaper: UTM values arrive from whatever built the link,
 * which is to say from anyone, and land in a file an administrator opens in a
 * spreadsheet.
 */
export const ATTRIBUTION_EXPORT_COLUMNS = [
  { key: "occurredAt", label: "Occurred at", value: (e: AttributionEvent) => e.occurredAt },
  { key: "eventType", label: "Event type", value: (e: AttributionEvent) => e.eventType },
  {
    key: "membershipId",
    label: "Membership ID",
    value: (e: AttributionEvent) => e.membershipId ?? "",
  },
  { key: "utmSource", label: "UTM source", value: (e: AttributionEvent) => e.utmSource ?? "" },
  { key: "utmMedium", label: "UTM medium", value: (e: AttributionEvent) => e.utmMedium ?? "" },
  {
    key: "utmCampaign",
    label: "UTM campaign",
    value: (e: AttributionEvent) => e.utmCampaign ?? "",
  },
  { key: "utmTerm", label: "UTM term", value: (e: AttributionEvent) => e.utmTerm ?? "" },
  { key: "utmContent", label: "UTM content", value: (e: AttributionEvent) => e.utmContent ?? "" },
  {
    key: "revenue",
    label: "Revenue",
    // Minor units divided out, but unformatted: a spreadsheet needs a number it
    // can sum, and an event with no revenue stays blank rather than becoming a
    // zero that would drag an average down.
    value: (e: AttributionEvent) =>
      e.revenueCents === null ? "" : (e.revenueCents / 100).toFixed(2),
  },
  { key: "currency", label: "Currency", value: (e: AttributionEvent) => e.currency ?? "" },
  {
    key: "attributed",
    label: "Attributed",
    // Computed here rather than left to a spreadsheet formula over five
    // columns, which would eventually disagree with the console.
    value: (e: AttributionEvent) => (isAttributed(e) ? "yes" : "no"),
  },
] as const;

export type AttributionExportColumnKey = (typeof ATTRIBUTION_EXPORT_COLUMNS)[number]["key"];

export const ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS: AttributionExportColumnKey[] =
  ATTRIBUTION_EXPORT_COLUMNS.map((column) => column.key);

/**
 * CSV of the events.
 *
 * Through the shared escaper: UTM values arrive from whoever built the link,
 * which is to say from anyone, and land in a file an administrator opens in a
 * spreadsheet. Passing no columns means every column, so the quick export from
 * the log toolbar keeps behaving as it did.
 */
export function attributionEventsToCsv(
  events: AttributionEvent[],
  columnKeys: ReadonlyArray<AttributionExportColumnKey> = ALL_ATTRIBUTION_EXPORT_COLUMN_KEYS,
): string {
  const selected = ATTRIBUTION_EXPORT_COLUMNS.filter((column) => columnKeys.includes(column.key));
  // Every column deselected would otherwise produce a file of empty lines that
  // looks like a broken export rather than an empty choice.
  const columns = selected.length > 0 ? selected : ATTRIBUTION_EXPORT_COLUMNS;

  return [
    csvRow(columns.map((column) => column.label)),
    ...events.map((event) => csvRow(columns.map((column) => column.value(event)))),
  ].join("\r\n");
}

/**
 * The filename an export downloads as.
 *
 * The filters are in the name because these files accumulate in a downloads
 * folder, and two called `attribution-events-2026-08-26.csv` — one filtered to
 * untracked events, one not — are indistinguishable at the point it matters.
 */
export function attributionExportFilename(filters: {
  eventType?: string;
  attribution?: string;
  q?: string;
  from?: string;
  to?: string;
}): string {
  const parts = ["attribution-events"];
  if (filters.eventType) parts.push(filters.eventType.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
  if (filters.attribution && filters.attribution !== "any") parts.push(filters.attribution);
  if (filters.from || filters.to) parts.push("dated");
  if (filters.q) parts.push("search");
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join("-")}.csv`;
}

/**
 * How far apart the beacon's clock and the server's were.
 *
 * `occurredAt` is supplied by whatever posted the event and can be anything;
 * `createdAt` is the server's own. A large gap means events were queued,
 * replayed, or posted with a bad clock — all of which shift a campaign's
 * apparent performance into the wrong day.
 */
export const CLOCK_SKEW_ALERT_MS = 5 * 60 * 1000;

export function clockSkewMs(occurredAt: string, createdAt: string): number | null {
  const occurred = Date.parse(occurredAt);
  const created = Date.parse(createdAt);
  if (Number.isNaN(occurred) || Number.isNaN(created)) return null;
  return created - occurred;
}

/** A skew worth mentioning, in either direction. */
export function isNotableSkew(skewMs: number | null): boolean {
  if (skewMs === null) return false;
  return Math.abs(skewMs) >= CLOCK_SKEW_ALERT_MS;
}

/** A signed, human-readable duration. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${String(hours)} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${String(days)} day${days === 1 ? "" : "s"}`;
}

/** Relative time, for the "2 hours ago" beside an absolute timestamp. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const diff = now - time;
  // Absolute, or a future timestamp falls into "just now" and the whole point
  // of showing it — a beacon clock running ahead — disappears.
  if (Math.abs(diff) < 60_000) return "just now";
  return diff > 0 ? `${formatDuration(diff)} ago` : `in ${formatDuration(diff)}`;
}

/**
 * How a null value on an axis reads.
 *
 * Not "(not set)" — on a breakdown these rows are the events that carried no
 * attribution at all, which is a finding rather than a missing cell.
 */
export const UNATTRIBUTED_LABEL = "No UTM";

export function dimensionLabel(dimension: AttributionDimension): string {
  if (dimension === "medium") return "Medium";
  if (dimension === "campaign") return "Campaign";
  return "Source";
}

/** A group's share of the total, or null when there is no total to divide by. */
export function shareOfTotal(events: number, total: number): number | null {
  if (total <= 0) return null;
  return (events / total) * 100;
}

export function formatShare(share: number | null): string {
  if (share === null) return "—";
  // One decimal: on a breakdown, 0.4% and 0.0% are different findings, and
  // rounding both to "0%" hides the smaller one entirely.
  return `${share.toFixed(1)}%`;
}

/**
 * Below this, a share is arithmetic rather than evidence.
 *
 * Twenty events split across six sources tells you nothing about which channel
 * works, and a screen that renders confident percentages over it invites a
 * decision it cannot support.
 */
export const THIN_DATA_THRESHOLD = 30;

export function isThinData(totalEvents: number): boolean {
  return totalEvents > 0 && totalEvents < THIN_DATA_THRESHOLD;
}

/**
 * CSV of a breakdown.
 *
 * Revenue is one column per currency rather than a single total, so the file
 * cannot be summed into a number that mixes them.
 */
export function attributionBreakdownToCsv(
  dimension: AttributionDimension,
  groups: ReadonlyArray<AttributionGroup>,
  totalEvents: number,
): string {
  const currencies = [
    ...new Set(groups.flatMap((group) => group.revenueByCurrency.map((entry) => entry.currency))),
  ].sort((a, b) => a.localeCompare(b));

  const headers = [
    dimensionLabel(dimension),
    "Events",
    "Share",
    "Revenue events",
    ...currencies.map((currency) => `Revenue (${currency})`),
    "Revenue without currency",
    "First seen",
    "Last seen",
  ];

  return [
    csvRow(headers),
    ...groups.map((group) =>
      csvRow([
        group.value ?? UNATTRIBUTED_LABEL,
        group.events,
        formatShare(shareOfTotal(group.events, totalEvents)),
        group.revenueEvents,
        ...currencies.map((currency) => {
          const entry = group.revenueByCurrency.find((item) => item.currency === currency);
          // Blank rather than 0: this group had no revenue in this currency,
          // which is not the same as zero revenue.
          return entry === undefined ? "" : (entry.amountCents / 100).toFixed(2);
        }),
        group.revenueWithoutCurrency === 0 ? "" : group.revenueWithoutCurrency,
        group.firstSeen,
        group.lastSeen,
      ]),
    ),
  ].join("\r\n");
}

/**
 * A day's attribution rate.
 *
 * Null on a silent day rather than 0%: nothing arrived, so there is no rate to
 * report, and drawing a zero would show a collapse that did not happen.
 */
export function dailyAttributionRate(day: { total: number; attributed: number }): number | null {
  if (day.total <= 0) return null;
  return (day.attributed / day.total) * 100;
}

/** A UTC day, labelled the way the series is bucketed. */
export function formatUtcDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Bar height as a percentage of the busiest day.
 *
 * Relative rather than absolute, because the useful question on a health chart
 * is "is today like the other days", not "how many is that".
 */
export function barHeightPercent(value: number, peak: number): number {
  if (peak <= 0 || value <= 0) return 0;
  // A floor so a real but tiny day is still visible rather than invisible.
  return Math.max(4, (value / peak) * 100);
}

/**
 * What each anomaly kind is, and what it breaks downstream.
 *
 * The consequence is the part that matters: an operator triaging a list needs
 * to know which of these is making a number wrong, not merely that it is
 * unusual.
 */
export const ANOMALY_COPY: Record<
  AttributionAnomalyKind,
  { title: string; why: string; fix: string }
> = {
  duplicate: {
    title: "Double-fired events",
    why: "The same learner, the same event type, the same instant, recorded more than once. A tag that fires twice inflates every count downstream — conversions, campaign volume and revenue event totals all read high.",
    fix: "Usually one tag installed in two places: the site-wide snippet and a page-level one. Check the tracking snippets for a duplicate install before trusting any conversion count over this period.",
  },
  "unrendered-placeholder": {
    title: "Unrendered placeholders",
    why: "A UTM value arrived as its own template — {{campaign}} or ${utm_source} — so the tag was published without interpolating it. The campaign it was meant to name is unattributable, and the rollups gain a source that does not exist.",
    fix: "Fix the link or tag template, then treat any campaign named after a placeholder as unattributed rather than as a real campaign.",
  },
  "future-dated": {
    title: "Dated in the future",
    why: "The event reports a time that has not happened yet, so the clock that produced it is ahead. It lands in a future bucket on every daily chart and is invisible in today's figures.",
    fix: "Almost always a client clock rather than a server one. Nothing can be corrected retroactively; the events stay where their timestamp puts them.",
  },
  "clock-skew": {
    title: "Recorded late",
    why: "The reported time and the time the server actually wrote the row disagree by more than the tolerance. Queued or replayed events look like this, and they can fall into the wrong reporting day.",
    fix: "A handful is ordinary. A cluster around one date usually means a batch was replayed, and any day-level comparison across that date is unsafe.",
  },
  "revenue-without-currency": {
    title: "Revenue with no currency",
    why: "An amount was recorded with no currency, so it cannot be added to any per-currency total. It silently drops out of every revenue figure in this console.",
    fix: "The posting integration is omitting the currency field. Until it is fixed, revenue totals for this period understate by these amounts.",
  },
};

/**
 * What each attribution gap is, and what usually causes it.
 *
 * The causes are the useful half: "no UTM at all" and "partially attributed"
 * look similar on screen and almost never share a fix.
 */
export const GAP_COPY: Record<
  AttributionGapKind,
  { title: string; why: string; causes: string[] }
> = {
  "no-utm": {
    title: "No attribution at all",
    why: "None of the five UTM fields were present. These events count toward totals but can never be credited to a campaign, and some of them are genuine direct traffic that never could be.",
    causes: [
      "A link shared without its UTM parameters — email signatures, chat, printed material.",
      "A redirect that drops the query string before the beacon reads it.",
      "Someone typing the address in or using a bookmark, which is not a fault at all.",
    ],
  },
  partial: {
    title: "Partially attributed",
    why: "Something arrived, but not the whole set the rollups group by. These events are counted as attributed everywhere else in this console, while still landing in a breakdown row that reads (not set) and comparing with nothing.",
    causes: [
      "A link template missing one field — usually the campaign, because it is the one edited per send.",
      "A tag that builds the URL from separate variables where one is empty.",
      "A referrer-derived source with no medium or campaign to go with it.",
    ],
  },
};

/** Share of the scanned events, or null when nothing was scanned. */
export function gapShare(affected: number, scanned: number): number | null {
  if (scanned <= 0) return null;
  return (affected / scanned) * 100;
}
