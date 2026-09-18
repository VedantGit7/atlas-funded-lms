import { clientApi } from "../../../lib/client-api";

/**
 * Client for the marketing attribution event log.
 *
 * The write side has been live for a while — the public marketing integrations
 * and the sales beacon both post here — so this reads an append-only log rather
 * than anything the console can change. Nothing in this module mutates.
 */

export const ATTRIBUTION_PRESENCE = ["any", "attributed", "none"] as const;

export type AttributionPresence = (typeof ATTRIBUTION_PRESENCE)[number];

export const ATTRIBUTION_PAGE_SIZE = 50;

export type AttributionEvent = {
  id: string;
  eventType: string;
  membershipId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** All five UTM fields; the list used to carry only the first three. */
  utmTerm: string | null;
  utmContent: string | null;
  revenueCents: number | null;
  currency: string | null;
  occurredAt: string;
};

export type AttributionPageInfo = {
  /** Opaque keyset cursor; never parse it here. */
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type AttributionSummary = {
  /** Every matching event, not the page the screen has loaded. */
  total: number;
  attributed: number;
  noUtm: number;
  revenueEvents: number;
  revenueByCurrency: Array<{ currency: string; amountCents: number; events: number }>;
  eventTypes: Array<{ eventType: string; total: number }>;
  eventTypeTotal: number;
  sources: Array<{ source: string | null; medium: string | null; total: number }>;
  sourceTotal: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
};

export type AttributionFilters = {
  eventType?: string;
  q?: string;
  attribution?: AttributionPresence;
  from?: string;
  to?: string;
  /**
   * Exact narrowing on one axis, as opposed to `q`'s text search across all of
   * them — searching "google" also matches a campaign named google.
   */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** "This axis was never set", which is not the same as `attribution: none`. */
  utmSourceUnset?: boolean;
  utmMediumUnset?: boolean;
  utmCampaignUnset?: boolean;
};

function toParams(filters: AttributionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.q) params.set("q", filters.q);
  // "any" is the absence of a filter, so it is not sent.
  if (filters.attribution && filters.attribution !== "any") {
    params.set("attribution", filters.attribution);
  }
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.utmSource) params.set("utmSource", filters.utmSource);
  if (filters.utmMedium) params.set("utmMedium", filters.utmMedium);
  if (filters.utmCampaign) params.set("utmCampaign", filters.utmCampaign);
  // Only sent when true: a false flag is the absence of the narrowing, and
  // sending it would add a parameter that can only ever be a no-op.
  if (filters.utmSourceUnset) params.set("utmSourceUnset", "true");
  if (filters.utmMediumUnset) params.set("utmMediumUnset", "true");
  if (filters.utmCampaignUnset) params.set("utmCampaignUnset", "true");
  return params;
}

export async function fetchAttributionEvents(
  filters: AttributionFilters,
  cursor?: string,
): Promise<{ items: AttributionEvent[]; pageInfo: AttributionPageInfo }> {
  const params = toParams(filters);
  params.set("limit", String(ATTRIBUTION_PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);

  const response = await clientApi.get<{
    data: { items: AttributionEvent[]; pageInfo: AttributionPageInfo };
  }>(`/api/v1/sales/attribution?${params.toString()}`);
  return response.data;
}

/**
 * Totals for the same filters the table is showing.
 *
 * Separate from the page because these are totals, not a window: "8 events with
 * no attribution" has to mean the tenant, not the fifty rows currently loaded.
 * A signal band derived in the browser can only ever describe the first page,
 * which is how a broken tracking link goes unnoticed.
 */
export async function fetchAttributionSummary(
  filters: AttributionFilters,
): Promise<AttributionSummary> {
  const query = toParams(filters).toString();
  const response = await clientApi.get<{ data: AttributionSummary }>(
    query ? `/api/v1/sales/attribution/summary?${query}` : "/api/v1/sales/attribution/summary",
  );
  return response.data;
}

export type AttributionEventDetail = AttributionEvent & {
  metadataJson: Record<string, unknown> | null;
  /** When the server wrote the row, as opposed to when the beacon says it happened. */
  createdAt: string;
};

/**
 * One event by id.
 *
 * A real lookup rather than a search through whatever the log happened to load:
 * the list is cursor-paginated, so an older event was previously
 * indistinguishable from one that does not exist. It also carries the metadata
 * the beacon attached and the time the server recorded the row, neither of
 * which the list returns.
 */
export async function fetchAttributionEvent(eventId: string): Promise<AttributionEventDetail> {
  const response = await clientApi.get<{ data: AttributionEventDetail }>(
    `/api/v1/sales/attribution/${encodeURIComponent(eventId)}`,
  );
  return response.data;
}

export type AttributionEventsExport = {
  items: AttributionEvent[];
  /** How many events match the filters in the whole log. */
  totalCount: number;
  /** True when the log holds more matching events than this response carries. */
  truncated: boolean;
  limit: number;
};

/**
 * The whole filtered log, for a downloadable file.
 *
 * Distinct from `fetchAttributionEvents` on purpose: that one is a cursor page,
 * and exporting through it would take one request per fifty rows with the
 * beacon free to write a new event between them — producing a file that is a
 * snapshot of nothing. This is a single read with a server-side ceiling, and it
 * says so when the ceiling is reached rather than truncating silently.
 */
export async function fetchAttributionEventsExport(
  filters: AttributionFilters,
): Promise<AttributionEventsExport> {
  const query = toParams(filters).toString();
  const response = await clientApi.get<{ data: AttributionEventsExport }>(
    query ? `/api/v1/sales/attribution/export?${query}` : "/api/v1/sales/attribution/export",
  );
  return response.data;
}

export const ATTRIBUTION_DIMENSIONS = ["source", "medium", "campaign"] as const;

export type AttributionDimension = (typeof ATTRIBUTION_DIMENSIONS)[number];

export type AttributionGroup = {
  /** Null is a real group: the events that carried nothing on this axis. */
  value: string | null;
  events: number;
  revenueEvents: number;
  revenueByCurrency: Array<{ currency: string; amountCents: number; events: number }>;
  /** Revenue on this axis with no currency, so it joins no per-currency total. */
  revenueWithoutCurrency: number;
  firstSeen: string;
  lastSeen: string;
};

export type AttributionBreakdown = {
  dimension: AttributionDimension;
  groups: AttributionGroup[];
  groupTotal: number;
  truncated: boolean;
  totalEvents: number;
  attributed: number;
  noUtm: number;
  distinctSources: number;
  distinctMediums: number;
  distinctCampaigns: number;
  revenueWithoutCurrency: number;
  matrix: {
    sources: Array<string | null>;
    mediums: Array<string | null>;
    cells: Array<{ source: string | null; medium: string | null; events: number }>;
    truncated: boolean;
  };
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
};

/**
 * The log grouped by one axis, across the whole log.
 *
 * A breakdown computed in the browser from a loaded page ranks campaigns by
 * whichever fifty events the screen happened to fetch, and the ranking shifts
 * as the operator scrolls. This is one server-side scan, so the ranking is the
 * ranking.
 */
export async function fetchAttributionBreakdown(
  filters: AttributionFilters,
  dimension: AttributionDimension,
): Promise<AttributionBreakdown> {
  const params = toParams(filters);
  params.set("dimension", dimension);
  const response = await clientApi.get<{ data: AttributionBreakdown }>(
    `/api/v1/sales/attribution/breakdown?${params.toString()}`,
  );
  return response.data;
}

export type AttributionHealthDay = {
  day: string;
  total: number;
  attributed: number;
  revenueEvents: number;
  skewed: number;
};

export type AttributionHealth = {
  days: number;
  since: string;
  /** One entry per day, zero-filled: a silent day is a zero, not a gap. */
  series: AttributionHealthDay[];
  windowTotal: number;
  windowAttributed: number;
  windowSkewed: number;
  lastEventAt: string | null;
  silentDays: number | null;
  trailingSilentDays: number;
  eventTypes: Array<{ eventType: string; total: number; lastSeenAt: string }>;
  skewToleranceSeconds: number;
};

/**
 * The log's daily shape.
 *
 * Every other read in this module returns a single aggregate, which cannot show
 * a beacon that stopped days ago — 60,000 events look identical whether the
 * newest arrived this morning or last month.
 */
export async function fetchAttributionHealth(days: number): Promise<AttributionHealth> {
  const params = new URLSearchParams({ days: String(days) });
  const response = await clientApi.get<{ data: AttributionHealth }>(
    `/api/v1/sales/attribution/health?${params.toString()}`,
  );
  return response.data;
}

export const ATTRIBUTION_ANOMALY_KINDS = [
  "duplicate",
  "unrendered-placeholder",
  "future-dated",
  "clock-skew",
  "revenue-without-currency",
] as const;

export type AttributionAnomalyKind = (typeof ATTRIBUTION_ANOMALY_KINDS)[number];

export type AttributionAnomalyEvent = AttributionEvent & {
  createdAt: string;
  /** Copies sharing this fingerprint; only set for duplicates. */
  copies: number | null;
};

export type AttributionAnomalies = {
  days: number;
  groups: Array<{
    kind: AttributionAnomalyKind;
    /** Every offending event of this kind, not just the sample. */
    total: number;
    truncated: boolean;
    items: AttributionAnomalyEvent[];
  }>;
  affectedTotal: number;
  sampleLimit: number;
  skewToleranceSeconds: number;
};

/**
 * The offending events themselves.
 *
 * The health screen counts some of these faults. A count says something is
 * wrong; only a list says which events to look at.
 */
export async function fetchAttributionAnomalies(days: number): Promise<AttributionAnomalies> {
  const params = new URLSearchParams({ days: String(days) });
  const response = await clientApi.get<{ data: AttributionAnomalies }>(
    `/api/v1/sales/attribution/anomalies?${params.toString()}`,
  );
  return response.data;
}

export const ATTRIBUTION_GAP_KINDS = ["no-utm", "partial"] as const;

export type AttributionGapKind = (typeof ATTRIBUTION_GAP_KINDS)[number];

export type AttributionGapEvent = AttributionEvent & {
  /** Which rollup fields this event lacks, named rather than inferred. */
  missing: Array<"source" | "medium" | "campaign">;
};

export type AttributionGaps = {
  days: number;
  groups: Array<{
    kind: AttributionGapKind;
    total: number;
    truncated: boolean;
    items: AttributionGapEvent[];
  }>;
  scannedTotal: number;
  affectedTotal: number;
  missingSource: number;
  missingMedium: number;
  missingCampaign: number;
  /** Counted for the cross-link; the rows are listed on the anomalies screen. */
  revenueWithoutCurrency: number;
  sampleLimit: number;
};

/**
 * Events that cannot be credited to a campaign.
 *
 * Scanned across the window rather than over a loaded page: a share of "the
 * loaded events" is a number about the screen, not about the academy.
 */
export async function fetchAttributionGaps(days: number): Promise<AttributionGaps> {
  const params = new URLSearchParams({ days: String(days) });
  const response = await clientApi.get<{ data: AttributionGaps }>(
    `/api/v1/sales/attribution/unattributed?${params.toString()}`,
  );
  return response.data;
}
