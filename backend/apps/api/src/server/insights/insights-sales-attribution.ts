import type { SalesAttributionSourceRow, SalesInsightSnapshot } from "./insights.repository";
import type { InsightSalesAttributionBoard } from "./insights.schemas";

export const SALES_ATTRIBUTION_EMPTY_CAPTION = "No attribution events recorded.";
export const SALES_ATTRIBUTION_CAVEAT =
  "Attributed revenue is credited to the source recorded on the learner's first tracked event. A learner with no tracked source appears under Direct.";
export const SALES_ATTRIBUTION_REPORT_HREF = "/admin/reports/sales-marketing";
export const SALES_ATTRIBUTION_TRACKING_HREF = "/admin/insights/marketing-insight";

function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function salesSourceLabel(source: string, medium: string): string {
  if (!medium || medium === "none") return source;
  return `${source} / ${medium}`;
}

export function salesRevenuePerEvent(revenueMajor: number, events: number): number | null {
  if (events <= 0) return null;
  return round2(revenueMajor / events);
}

export function buildInsightSalesAttribution(
  snapshot: Pick<
    SalesInsightSnapshot,
    "currency" | "revenueCents" | "attributionTotal" | "attributionRevenueCents"
  >,
  sources: SalesAttributionSourceRow[],
  generatedAt = new Date().toISOString(),
): InsightSalesAttributionBoard {
  const attributedCents = sources.reduce((sum, row) => sum + row.revenueCents, 0);
  const attributedMajor = centsToMajor(attributedCents);
  const totalRevenueMajor = centsToMajor(snapshot.revenueCents);
  const unattributedMajor = Math.max(round2(totalRevenueMajor - attributedMajor), 0);
  const events = sources.reduce((sum, row) => sum + row.count, 0);
  const empty = events <= 0;
  const attributedSharePct =
    totalRevenueMajor > 0 ? round1((attributedMajor / totalRevenueMajor) * 100) : null;
  const revenuePerEvent = salesRevenuePerEvent(attributedMajor, events);
  const maxEvents = Math.max(...sources.map((row) => row.count), 0);
  const maxRevenue = Math.max(...sources.map((row) => centsToMajor(row.revenueCents)), 0);

  const rows = sources.map((row) => {
    const revenueMajor = centsToMajor(row.revenueCents);
    const eventSharePct = events > 0 ? round1((row.count / events) * 100) : null;
    const revenueSharePct =
      attributedMajor > 0 ? round1((revenueMajor / attributedMajor) * 100) : null;
    const rate = salesRevenuePerEvent(revenueMajor, row.count);
    const residual =
      revenuePerEvent == null ? null : round2(revenueMajor - row.count * revenuePerEvent);
    return {
      id: `${row.source}::${row.medium}`,
      source: row.source,
      medium: row.medium,
      label: salesSourceLabel(row.source, row.medium),
      events: row.count,
      revenueMajor,
      eventSharePct,
      revenueSharePct,
      revenuePerEvent: rate,
      residual,
      href: SALES_ATTRIBUTION_REPORT_HREF,
      pattern: null as InsightSalesAttributionBoard["sources"][number]["pattern"],
    };
  });

  let highVolume: (typeof rows)[number] | null = null;
  let lowVolume: (typeof rows)[number] | null = null;
  for (const row of rows) {
    if (row.eventSharePct == null || row.revenueSharePct == null) continue;
    const volumeGap = row.eventSharePct - row.revenueSharePct;
    const valueGap = row.revenueSharePct - row.eventSharePct;
    if (
      volumeGap >= 5 &&
      (!highVolume ||
        volumeGap > (highVolume.eventSharePct ?? 0) - (highVolume.revenueSharePct ?? 0))
    ) {
      highVolume = row;
    }
    if (
      valueGap >= 5 &&
      (!lowVolume || valueGap > (lowVolume.revenueSharePct ?? 0) - (lowVolume.eventSharePct ?? 0))
    ) {
      lowVolume = row;
    }
  }
  if (highVolume) highVolume.pattern = "high-volume low-value";
  if (lowVolume && lowVolume.id !== highVolume?.id) lowVolume.pattern = "low-volume high-value";

  let aboveLine: (typeof rows)[number] | null = null;
  for (const row of rows) {
    if (row.residual == null || row.residual <= 0) continue;
    if (!aboveLine || row.residual > (aboveLine.residual ?? 0)) aboveLine = row;
  }

  const named = rows.slice(0, 4);
  const namedIds = new Set(named.map((row) => row.id));
  const otherRevenue = rows
    .filter((row) => !namedIds.has(row.id))
    .reduce((sum, row) => sum + row.revenueMajor, 0);
  const compositionDenom = attributedMajor + unattributedMajor;
  const composition: InsightSalesAttributionBoard["composition"] = named.map((row) => ({
    id: row.id,
    label: row.label,
    kind: "source" as const,
    revenueMajor: row.revenueMajor,
    sharePct: compositionDenom > 0 ? round1((row.revenueMajor / compositionDenom) * 100) : null,
  }));
  if (otherRevenue > 0) {
    composition.push({
      id: "other",
      label: "Other sources",
      kind: "other",
      revenueMajor: round2(otherRevenue),
      sharePct: compositionDenom > 0 ? round1((otherRevenue / compositionDenom) * 100) : null,
    });
  }
  if (unattributedMajor > 0) {
    composition.push({
      id: "unattributed",
      label: "Unattributed",
      kind: "unattributed",
      revenueMajor: unattributedMajor,
      sharePct: compositionDenom > 0 ? round1((unattributedMajor / compositionDenom) * 100) : null,
    });
  }

  const sourcesAbove1Pct = rows.filter(
    (row) => row.revenueSharePct != null && row.revenueSharePct >= 1,
  ).length;

  return {
    slug: "sales-insight",
    title: "Attribution",
    generatedAt,
    currency: snapshot.currency,
    reportHref: SALES_ATTRIBUTION_REPORT_HREF,
    trackingHref: SALES_ATTRIBUTION_TRACKING_HREF,
    caveat: SALES_ATTRIBUTION_CAVEAT,
    empty,
    caption: empty
      ? SALES_ATTRIBUTION_EMPTY_CAPTION
      : aboveLine
        ? `${aboveLine.label} sits furthest above the revenue-per-event line.`
        : "Sources ranked by attributed revenue.",
    attributedRevenue: attributedMajor,
    attributedSharePct,
    totalRevenue: totalRevenueMajor,
    unattributedRevenue: unattributedMajor,
    events,
    sourceCount: rows.length,
    sourcesAbove1Pct,
    revenuePerEvent,
    maxEvents,
    maxRevenue,
    composition,
    sources: rows,
  };
}

export function salesAttributionToCsv(board: InsightSalesAttributionBoard): string {
  const lines = [
    ["Source", "Events", "Attributed revenue", "Share of attributed", "Revenue per event"].join(
      ",",
    ),
  ];
  for (const row of board.sources) {
    lines.push(
      [
        row.label,
        String(row.events),
        row.revenueMajor.toFixed(2),
        row.revenueSharePct == null ? "-" : `${row.revenueSharePct}%`,
        row.revenuePerEvent == null ? "-" : row.revenuePerEvent.toFixed(2),
      ].join(","),
    );
  }
  return lines.join("\n");
}
