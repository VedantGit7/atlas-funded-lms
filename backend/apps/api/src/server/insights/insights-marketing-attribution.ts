import type { InsightMarketingAttributionBoard } from "./insights.schemas";

export const MARKETING_ATTRIBUTION_EMPTY_CAPTION = "No attribution events recorded";
export const MARKETING_ATTRIBUTION_CAVEAT =
  "Source, medium, and campaign are three dimensions over the same attribution events. Each breakdown sums to the same total; they do not add to each other. Events with no value recorded appear under Direct or Not set.";
export const MARKETING_ATTRIBUTION_REPORT_HREF = "/admin/reports/sales-marketing";
export const MARKETING_ATTRIBUTION_SALES_HREF = "/admin/insights/sales-insight/attribution";
export const MARKETING_ATTRIBUTION_TRACKING_HREF = "/admin/marketing/forms";
export const MARKETING_ATTRIBUTION_UNSTABLE_THRESHOLD = 100;

export type MarketingAttributionDimInput = {
  value: string;
  count: number;
  revenueCents: number;
};

export type MarketingAttributionCrossInput = {
  source: string;
  medium: string;
  count: number;
};

export type MarketingAttributionSnapshotInput = {
  currency: string;
  events: number;
  events30d: number;
  attributedRevenueCents: number;
  sourceCount: number;
  mediumCount: number;
  campaignCount: number;
};

function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function revenuePerEvent(revenueMajor: number, events: number): number | null {
  if (events <= 0) return null;
  return round2(revenueMajor / events);
}

function isNotSet(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "(not set)" ||
    normalized === "not set" ||
    normalized === "none"
  );
}

function buildDimension(
  id: "source" | "medium" | "campaign",
  label: string,
  rowsIn: MarketingAttributionDimInput[],
  totalEvents: number,
  attributedMajor: number,
  overallRate: number | null,
  reportHref: string,
): InsightMarketingAttributionBoard["dimensions"][typeof id] {
  const sorted = [...rowsIn].sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents);
  const rows = sorted.map((row) => {
    const revenueMajor = centsToMajor(row.revenueCents);
    const eventSharePct = totalEvents > 0 ? round1((row.count / totalEvents) * 100) : null;
    const revenueSharePct =
      attributedMajor > 0 ? round1((revenueMajor / attributedMajor) * 100) : null;
    const rate = revenuePerEvent(revenueMajor, row.count);
    const residual = overallRate == null ? null : round2(revenueMajor - row.count * overallRate);
    return {
      id: `${id}:${row.value}`,
      value: row.value,
      events: row.count,
      revenueMajor,
      eventSharePct,
      revenueSharePct,
      revenuePerEvent: rate,
      residual,
      unstable: row.count > 0 && row.count < MARKETING_ATTRIBUTION_UNSTABLE_THRESHOLD,
      href: reportHref,
      pattern:
        null as InsightMarketingAttributionBoard["dimensions"]["source"]["rows"][number]["pattern"],
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

  const named = rows.filter((row) => !isNotSet(row.value)).slice(0, 4);
  const namedIds = new Set(named.map((row) => row.id));
  const notSetRows = rows.filter((row) => isNotSet(row.value));
  const otherRows = rows.filter((row) => !namedIds.has(row.id) && !isNotSet(row.value));
  const otherEvents = otherRows.reduce((sum, row) => sum + row.events, 0);
  const notSetEvents = notSetRows.reduce((sum, row) => sum + row.events, 0);

  const composition: InsightMarketingAttributionBoard["dimensions"]["source"]["composition"] =
    named.map((row) => ({
      id: row.id,
      label: row.value,
      kind: "named" as const,
      events: row.events,
      sharePct: totalEvents > 0 ? round1((row.events / totalEvents) * 100) : null,
    }));
  if (otherEvents > 0) {
    composition.push({
      id: `${id}:other`,
      label: "Other",
      kind: "other",
      events: otherEvents,
      sharePct: totalEvents > 0 ? round1((otherEvents / totalEvents) * 100) : null,
    });
  }
  if (notSetEvents > 0) {
    composition.push({
      id: `${id}:not-set`,
      label: "Not set",
      kind: "not-set",
      events: notSetEvents,
      sharePct: totalEvents > 0 ? round1((notSetEvents / totalEvents) * 100) : null,
    });
  }

  return {
    id,
    label,
    composition,
    rows,
    caption: aboveLine
      ? `${aboveLine.value} is furthest above the average rate.`
      : `Values ranked by ${label.toLowerCase()} event volume.`,
    maxEvents: Math.max(...rows.map((row) => row.events), 0),
    maxRevenue: Math.max(...rows.map((row) => row.revenueMajor), 0),
    revenuePerEvent: overallRate,
  };
}

export function buildInsightMarketingAttribution(
  snapshot: MarketingAttributionSnapshotInput,
  sources: MarketingAttributionDimInput[],
  mediums: MarketingAttributionDimInput[],
  campaigns: MarketingAttributionDimInput[],
  crossPairs: MarketingAttributionCrossInput[],
  generatedAt = new Date().toISOString(),
): InsightMarketingAttributionBoard {
  const attributedMajor = centsToMajor(snapshot.attributedRevenueCents);
  const events =
    snapshot.events > 0 ? snapshot.events : sources.reduce((sum, row) => sum + row.count, 0);
  const empty = events <= 0;
  const overallRate = revenuePerEvent(attributedMajor, events);
  const campaignsWithRevenue = campaigns.filter((row) => row.revenueCents > 0).length;

  const dimensions = {
    source: buildDimension(
      "source",
      "Source",
      sources,
      events,
      attributedMajor,
      overallRate,
      MARKETING_ATTRIBUTION_REPORT_HREF,
    ),
    medium: buildDimension(
      "medium",
      "Medium",
      mediums,
      events,
      attributedMajor,
      overallRate,
      MARKETING_ATTRIBUTION_REPORT_HREF,
    ),
    campaign: buildDimension(
      "campaign",
      "Campaign",
      campaigns,
      events,
      attributedMajor,
      overallRate,
      MARKETING_ATTRIBUTION_REPORT_HREF,
    ),
  };

  const crossTotal = crossPairs.reduce((sum, row) => sum + row.count, 0) || events || 1;
  const mappedCross = crossPairs
    .map((row) => ({
      source: row.source,
      medium: row.medium,
      events: row.count,
      sharePct: round1((row.count / crossTotal) * 100),
    }))
    .sort((a, b) => b.events - a.events);
  const topPair = mappedCross[0] ?? null;

  return {
    slug: "marketing-insight",
    title: "Attribution",
    subtitle: "The same events split by source, medium, and UTM campaign.",
    generatedAt,
    currency: snapshot.currency,
    reportHref: MARKETING_ATTRIBUTION_REPORT_HREF,
    salesAttributionHref: MARKETING_ATTRIBUTION_SALES_HREF,
    trackingHref: MARKETING_ATTRIBUTION_TRACKING_HREF,
    caveat: MARKETING_ATTRIBUTION_CAVEAT,
    empty,
    caption: empty
      ? MARKETING_ATTRIBUTION_EMPTY_CAPTION
      : "Revenue-side view of the same events lives on Sales Insight.",
    events,
    events30d: snapshot.events30d,
    attributedRevenue: attributedMajor,
    sourceCount: snapshot.sourceCount || sources.length,
    mediumCount: snapshot.mediumCount || mediums.length,
    campaignCount: snapshot.campaignCount || campaigns.length,
    campaignsWithRevenue,
    unstableEventThreshold: MARKETING_ATTRIBUTION_UNSTABLE_THRESHOLD,
    dimensions,
    crossPairs: mappedCross.slice(0, 36),
    crossCaption:
      !empty && topPair
        ? `${topPair.source} / ${topPair.medium} accounts for ${String(topPair.sharePct)}% of attributed events.`
        : empty
          ? null
          : "Cross-dimension pairs are not available for this payload.",
  };
}

export function marketingAttributionToCsv(
  board: InsightMarketingAttributionBoard,
  dimension: "source" | "medium" | "campaign",
): string {
  const dim = board.dimensions[dimension];
  const lines = [
    [
      dim.label,
      "Events",
      "Share of events",
      "Attributed revenue",
      "Share of revenue",
      "Revenue per event",
    ].join(","),
  ];
  for (const row of dim.rows) {
    lines.push(
      [
        row.value,
        String(row.events),
        row.eventSharePct == null ? "-" : `${row.eventSharePct}%`,
        row.revenueMajor.toFixed(2),
        row.revenueSharePct == null ? "-" : `${row.revenueSharePct}%`,
        row.revenuePerEvent == null ? "-" : row.revenuePerEvent.toFixed(2),
      ].join(","),
    );
  }
  return lines.join("\n");
}
