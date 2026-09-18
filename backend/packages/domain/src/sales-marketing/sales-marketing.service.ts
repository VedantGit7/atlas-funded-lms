import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import { attributionEventNotFound } from "./sales-marketing.errors";
import {
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  PURGE_BATCH_LIMIT,
  attributionRetentionRepository,
  purgeExpiredAttributionEvents,
} from "./attribution-retention";
import {
  ATTRIBUTION_BREAKDOWN_LIMIT,
  attributionEventResponseSchema,
  ATTRIBUTION_EXPORT_LIMIT,
  ATTRIBUTION_MATRIX_AXIS_LIMIT,
  ATTRIBUTION_ANOMALY_SAMPLE_LIMIT,
  ATTRIBUTION_SKEW_TOLERANCE_SECONDS,
  ATTRIBUTION_GAP_SAMPLE_LIMIT,
  attributionAnomaliesQuerySchema,
  attributionGapsQuerySchema,
  attributionGapsResponseSchema,
  attributionAnomaliesResponseSchema,
  attributionBreakdownQuerySchema,
  attributionHealthQuerySchema,
  attributionHealthResponseSchema,
  attributionRetentionBodySchema,
  attributionRetentionPreviewQuerySchema,
  attributionRetentionPreviewResponseSchema,
  attributionRetentionResponseSchema,
  purgeAttributionEventsResponseSchema,
  attributionBreakdownResponseSchema,
  attributionSummaryQuerySchema,
  exportAttributionEventsQuerySchema,
  exportAttributionEventsResponseSchema,
  attributionSummaryResponseSchema,
  createAttributionEventBodySchema,
  createAttributionEventResponseSchema,
  listAttributionEventsQuerySchema,
  listAttributionEventsResponseSchema,
} from "./sales-marketing.dto";
import {
  salesMarketingRepository,
  type AttributionCursor,
  type AttributionEventFilter,
  ATTRIBUTION_ANOMALY_KINDS,
  ATTRIBUTION_GAP_KINDS,
  type AttributionMatrixRow,
  type AttributionEventRow,
} from "./sales-marketing.repository";

/**
 * The cursor is the ordering tuple, encoded.
 *
 * Opaque so no caller is tempted to parse it and reintroduce the id-only
 * comparison this replaced.
 */
function encodeCursor(row: { occurredAt: string; id: string }): string {
  return Buffer.from(JSON.stringify(row), "utf8").toString("base64url");
}

function decodeCursor(raw: string | undefined): AttributionCursor | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (parsed === null || typeof parsed !== "object") return undefined;
    const { occurredAt, id } = parsed as Record<string, unknown>;
    if (typeof occurredAt !== "string" || typeof id !== "string") return undefined;
    return { occurredAt, id };
  } catch {
    // A stale or hand-edited cursor reads as "start again" rather than a 500 on
    // a read-only log screen.
    return undefined;
  }
}

function toFilter(query: {
  eventType?: string | undefined;
  q?: string | undefined;
  attribution?: "any" | "attributed" | "none" | undefined;
  from?: string | undefined;
  to?: string | undefined;
  utmSource?: string | undefined;
  utmMedium?: string | undefined;
  utmCampaign?: string | undefined;
  utmSourceUnset?: boolean | undefined;
  utmMediumUnset?: boolean | undefined;
  utmCampaignUnset?: boolean | undefined;
}): AttributionEventFilter {
  return {
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.q ? { q: query.q } : {}),
    // "any" is the absence of a filter; carrying it through would add a
    // predicate that can only ever be true.
    ...(query.attribution && query.attribution !== "any" ? { attribution: query.attribution } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.utmSource ? { utmSource: query.utmSource } : {}),
    ...(query.utmMedium ? { utmMedium: query.utmMedium } : {}),
    ...(query.utmCampaign ? { utmCampaign: query.utmCampaign } : {}),
    // Only carried when true. A false flag is the absence of the narrowing, and
    // passing it through would add a predicate that can only ever be true.
    ...(query.utmSourceUnset ? { utmSourceUnset: true } : {}),
    ...(query.utmMediumUnset ? { utmMediumUnset: true } : {}),
    ...(query.utmCampaignUnset ? { utmCampaignUnset: true } : {}),
  };
}

function toDto(row: AttributionEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    membershipId: row.membership_id,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmTerm: row.utm_term,
    utmContent: row.utm_content,
    revenueCents: row.revenue_cents,
    currency: row.currency,
    occurredAt: row.occurred_at.toISOString(),
  };
}

export async function createAttributionEvent(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createAttributionEventBodySchema.parse(rawBody);
  const row = await salesMarketingRepository.insertEvent(tx, {
    eventType: body.eventType,
    membershipId: body.membershipId ?? ctx.actorMembershipId,
    utmSource: body.utmSource ?? null,
    utmMedium: body.utmMedium ?? null,
    utmCampaign: body.utmCampaign ?? null,
    utmTerm: body.utmTerm ?? null,
    utmContent: body.utmContent ?? null,
    revenueCents: body.revenueCents ?? null,
    currency: body.currency ?? null,
    ...(body.metadataJson !== undefined ? { metadataJson: body.metadataJson } : {}),
    ...(body.occurredAt ? { occurredAt: new Date(body.occurredAt) } : {}),
  });

  return createAttributionEventResponseSchema.parse({ data: toDto(row) });
}

export async function listAttributionEvents(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = listAttributionEventsQuerySchema.parse(rawQuery);
  const cursor = decodeCursor(query.cursor);
  const rows = await salesMarketingRepository.listEvents(tx, {
    limit: query.limit,
    ...toFilter(query),
    ...(cursor ? { cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(toDto);
  const last = items.at(-1);

  return listAttributionEventsResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last ? encodeCursor({ occurredAt: last.occurredAt, id: last.id }) : null,
        hasNextPage,
      },
    },
  });
}

/**
 * One event, in full.
 *
 * A real lookup rather than a search through whatever the log happened to load:
 * the list is cursor-paginated, so an older event was previously
 * indistinguishable from one that does not exist. It also returns the three
 * fields the list omits — `utm_term`, `utm_content` and the metadata blob — so
 * an event attributed solely by one of them stops reading as unattributed.
 */
export async function getAttributionEvent(tx: TenantTx, _ctx: ServiceCtx, eventId: string) {
  const row = await salesMarketingRepository.findEventById(tx, eventId);
  if (!row) throw attributionEventNotFound();

  return attributionEventResponseSchema.parse({
    data: {
      ...toDto(row),
      // A non-object blob is not a record. Passing one through would fail the
      // schema and turn a readable event into a 500.
      metadataJson:
        row.metadata_json === null || typeof row.metadata_json !== "object"
          ? null
          : (row.metadata_json as Record<string, unknown>),
      createdAt: row.created_at.toISOString(),
    },
  });
}

/**
 * The top values on one axis of a cross-tab, by event count.
 *
 * Null — the events carrying nothing on this axis — always survives the cut
 * when it is present at all: it is usually the largest group and the one worth
 * looking at, so dropping it for a long tail of named values would hide the
 * finding.
 */
function topAxisValues(
  rows: AttributionMatrixRow[],
  pick: (row: AttributionMatrixRow) => string | null,
  limit: number,
): Array<string | null> {
  const totals = new Map<string, { value: string | null; total: number }>();
  for (const row of rows) {
    const value = pick(row);
    const key = value ?? "\u0000null";
    const entry = totals.get(key) ?? { value, total: 0 };
    entry.total += Number(row.total);
    totals.set(key, entry);
  }
  return [...totals.values()]
    .sort((a, b) => b.total - a.total || (a.value ?? "").localeCompare(b.value ?? ""))
    .slice(0, limit)
    .map((entry) => entry.value);
}

/**
 * The log grouped by source, medium or campaign, across the whole log.
 *
 * Every figure is a server-side scan. A breakdown assembled in the browser from
 * a loaded page would tell an operator which campaign is winning based on
 * whichever fifty events the screen happened to fetch — and the ranking would
 * change as they scrolled.
 *
 * Campaign is a genuinely new axis: the summary scan groups by event type,
 * source and medium, so until now nothing in this console could group by
 * campaign at all.
 */
export async function getAttributionBreakdown(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = attributionBreakdownQuerySchema.parse(rawQuery);
  const filter = toFilter(query);

  const [groupRows, counts, matrixRows, buckets] = await Promise.all([
    salesMarketingRepository.groupEventsByDimension(tx, {
      ...filter,
      dimension: query.dimension,
    }),
    salesMarketingRepository.countAttributionDimensions(tx, filter),
    salesMarketingRepository.crossTabSourceMedium(tx, filter),
    salesMarketingRepository.summariseEvents(tx, filter),
  ]);

  // Fold the (value, currency) buckets back into one row per value.
  const byValue = new Map<
    string,
    {
      value: string | null;
      events: number;
      revenueEvents: number;
      revenueWithoutCurrency: number;
      byCurrency: Map<string, { amountCents: number; events: number }>;
      firstSeen: Date;
      lastSeen: Date;
    }
  >();

  for (const row of groupRows) {
    const key = row.value ?? "\u0000null";
    const entry = byValue.get(key) ?? {
      value: row.value,
      events: 0,
      revenueEvents: 0,
      revenueWithoutCurrency: 0,
      byCurrency: new Map<string, { amountCents: number; events: number }>(),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    };
    const revenueEvents = Number(row.revenue_events);
    entry.events += Number(row.total);
    entry.revenueEvents += revenueEvents;
    if (row.currency === null) {
      // Revenue with no currency cannot join a per-currency total; counted
      // separately rather than silently dropped.
      entry.revenueWithoutCurrency += revenueEvents;
    } else if (revenueEvents > 0) {
      const currency = entry.byCurrency.get(row.currency) ?? { amountCents: 0, events: 0 };
      currency.amountCents += Number(row.revenue_cents);
      currency.events += revenueEvents;
      entry.byCurrency.set(row.currency, currency);
    }
    if (row.first_seen < entry.firstSeen) entry.firstSeen = row.first_seen;
    if (row.last_seen > entry.lastSeen) entry.lastSeen = row.last_seen;
    byValue.set(key, entry);
  }

  const ranked = [...byValue.values()].sort(
    (a, b) => b.events - a.events || (a.value ?? "").localeCompare(b.value ?? ""),
  );

  let totalEvents = 0;
  let noUtm = 0;
  let firstOccurredAt: Date | null = null;
  let lastOccurredAt: Date | null = null;
  for (const bucket of buckets) {
    totalEvents += Number(bucket.total);
    noUtm += Number(bucket.no_utm);
    if (firstOccurredAt === null || bucket.first_occurred_at < firstOccurredAt) {
      firstOccurredAt = bucket.first_occurred_at;
    }
    if (lastOccurredAt === null || bucket.last_occurred_at > lastOccurredAt) {
      lastOccurredAt = bucket.last_occurred_at;
    }
  }

  const sources = topAxisValues(matrixRows, (row) => row.utm_source, ATTRIBUTION_MATRIX_AXIS_LIMIT);
  const mediums = topAxisValues(matrixRows, (row) => row.utm_medium, ATTRIBUTION_MATRIX_AXIS_LIMIT);
  const sourceKeys = new Set(sources.map((value) => value ?? "\u0000null"));
  const mediumKeys = new Set(mediums.map((value) => value ?? "\u0000null"));
  const cells = matrixRows.filter(
    (row) =>
      sourceKeys.has(row.utm_source ?? "\u0000null") &&
      mediumKeys.has(row.utm_medium ?? "\u0000null"),
  );

  return attributionBreakdownResponseSchema.parse({
    data: {
      dimension: query.dimension,
      groups: ranked.slice(0, query.limit).map((entry) => ({
        value: entry.value,
        events: entry.events,
        revenueEvents: entry.revenueEvents,
        // Never a single grand total: adding INR to USD produces a number that
        // means nothing and looks authoritative.
        revenueByCurrency: [...entry.byCurrency.entries()]
          .map(([currency, value]) => ({ currency, ...value }))
          .sort((a, b) => a.currency.localeCompare(b.currency)),
        revenueWithoutCurrency: entry.revenueWithoutCurrency,
        firstSeen: entry.firstSeen.toISOString(),
        lastSeen: entry.lastSeen.toISOString(),
      })),
      groupTotal: ranked.length,
      truncated: ranked.length > query.limit,
      totalEvents,
      attributed: totalEvents - noUtm,
      noUtm,
      distinctSources: Number(counts.distinct_sources),
      distinctMediums: Number(counts.distinct_mediums),
      distinctCampaigns: Number(counts.distinct_campaigns),
      revenueWithoutCurrency: Number(counts.revenue_without_currency),
      matrix: {
        sources,
        mediums,
        cells: cells.map((row) => ({
          source: row.utm_source,
          medium: row.utm_medium,
          events: Number(row.total),
        })),
        truncated: cells.length < matrixRows.length,
      },
      firstOccurredAt: firstOccurredAt === null ? null : firstOccurredAt.toISOString(),
      lastOccurredAt: lastOccurredAt === null ? null : lastOccurredAt.toISOString(),
    },
  });
}

/**
 * The filtered log as one set of rows, for a CSV the operator downloads.
 *
 * The log screen's own export could only ever cover the rows already loaded —
 * fifty at a time — so exporting a quarter meant pressing "Load more" until the
 * whole quarter was in the browser. The count comes from the same summary
 * aggregate the signal band uses, so `truncated` is a statement about the whole
 * filtered set rather than about this response.
 */
export async function exportAttributionEvents(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = exportAttributionEventsQuerySchema.parse(rawQuery);
  const filter = toFilter(query);

  const [rows, buckets] = await Promise.all([
    salesMarketingRepository.exportEvents(tx, { ...filter, limit: ATTRIBUTION_EXPORT_LIMIT }),
    salesMarketingRepository.summariseEvents(tx, filter),
  ]);

  const totalCount = buckets.reduce((sum, bucket) => sum + Number(bucket.total), 0);

  return exportAttributionEventsResponseSchema.parse({
    data: {
      items: rows.map(toDto),
      totalCount,
      truncated: totalCount > rows.length,
      limit: ATTRIBUTION_EXPORT_LIMIT,
    },
  });
}

/**
 * Totals over every matching event, not over the page the screen has loaded.
 *
 * The log is cursor paginated, so a signal band computed in the browser can only
 * ever describe the first fifty rows — and "8 events with no attribution" read
 * as a tenant-wide figure when it means "8 of the 50 I happened to fetch" is how
 * a broken tracking link goes unnoticed for a month.
 */
export async function summariseAttributionEvents(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = attributionSummaryQuerySchema.parse(rawQuery);
  const buckets = await salesMarketingRepository.summariseEvents(tx, toFilter(query));

  const byEventType = new Map<string, number>();
  const bySource = new Map<
    string,
    { source: string | null; medium: string | null; total: number }
  >();
  const byCurrency = new Map<string, { amountCents: number; events: number }>();
  let total = 0;
  let noUtm = 0;
  let revenueEvents = 0;
  let firstOccurredAt: Date | null = null;
  let lastOccurredAt: Date | null = null;

  for (const bucket of buckets) {
    const count = Number(bucket.total);
    total += count;
    noUtm += Number(bucket.no_utm);
    revenueEvents += Number(bucket.revenue_events);

    byEventType.set(bucket.event_type, (byEventType.get(bucket.event_type) ?? 0) + count);

    // Null source and null medium are a real bucket — the events carrying no
    // attribution at all — so they group under a sentinel key rather than being
    // dropped from the breakdown.
    const sourceKey = `${bucket.utm_source ?? ""}|${bucket.utm_medium ?? ""}`;
    const source = bySource.get(sourceKey) ?? {
      source: bucket.utm_source,
      medium: bucket.utm_medium,
      total: 0,
    };
    source.total += count;
    bySource.set(sourceKey, source);

    if (bucket.currency !== null && Number(bucket.revenue_events) > 0) {
      const currency = byCurrency.get(bucket.currency) ?? { amountCents: 0, events: 0 };
      currency.amountCents += Number(bucket.revenue_cents);
      currency.events += Number(bucket.revenue_events);
      byCurrency.set(bucket.currency, currency);
    }

    if (firstOccurredAt === null || bucket.first_occurred_at < firstOccurredAt) {
      firstOccurredAt = bucket.first_occurred_at;
    }
    if (lastOccurredAt === null || bucket.last_occurred_at > lastOccurredAt) {
      lastOccurredAt = bucket.last_occurred_at;
    }
  }

  const eventTypes = [...byEventType.entries()]
    .map(([eventType, count]) => ({ eventType, total: count }))
    .sort((a, b) => b.total - a.total || a.eventType.localeCompare(b.eventType));
  const sources = [...bySource.values()].sort(
    (a, b) => b.total - a.total || (a.source ?? "").localeCompare(b.source ?? ""),
  );

  return attributionSummaryResponseSchema.parse({
    data: {
      total,
      attributed: total - noUtm,
      noUtm,
      revenueEvents,
      // Never a single grand total: adding INR to USD produces a number that
      // means nothing and looks authoritative.
      revenueByCurrency: [...byCurrency.entries()]
        .map(([currency, value]) => ({ currency, ...value }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      eventTypes: eventTypes.slice(0, ATTRIBUTION_BREAKDOWN_LIMIT),
      eventTypeTotal: eventTypes.length,
      sources: sources.slice(0, ATTRIBUTION_BREAKDOWN_LIMIT),
      sourceTotal: sources.length,
      firstOccurredAt: firstOccurredAt === null ? null : firstOccurredAt.toISOString(),
      lastOccurredAt: lastOccurredAt === null ? null : lastOccurredAt.toISOString(),
    },
  });
}

/**
 * The tenant's retention policy, with the impact of the current setting.
 *
 * The impact figures are the point: a window is a decision to delete, and the
 * screen showing it should say how much before anyone presses save.
 */
export async function getAttributionRetention(tx: TenantTx, _ctx: ServiceCtx) {
  const settings = await attributionRetentionRepository.get(tx);
  const retentionDays = settings?.retention_days ?? null;
  const impact = await attributionRetentionRepository.previewImpact(tx, retentionDays);

  return attributionRetentionResponseSchema.parse({
    data: {
      retentionDays,
      updatedAt: settings?.updated_at?.toISOString() ?? null,
      updatedByName: settings?.updated_by_name ?? null,
      totalEvents: impact.total,
      deletableNow: impact.deletable,
      oldestOccurredAt: impact.oldest?.toISOString() ?? null,
      minRetentionDays: MIN_RETENTION_DAYS,
      maxRetentionDays: MAX_RETENTION_DAYS,
    },
  });
}

/**
 * What a proposed window would delete, without saving it.
 *
 * Read-only on purpose: an operator has to be able to ask "what would 90 days
 * cost me" and get a number back without having committed to anything.
 */
export async function previewAttributionRetention(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = attributionRetentionPreviewQuerySchema.parse(rawQuery);
  const retentionDays = query.retentionDays ?? null;
  const impact = await attributionRetentionRepository.previewImpact(tx, retentionDays);

  return attributionRetentionPreviewResponseSchema.parse({
    data: {
      retentionDays,
      totalEvents: impact.total,
      deletable: impact.deletable,
      oldestOccurredAt: impact.oldest?.toISOString() ?? null,
    },
  });
}

/**
 * Sets the retention window.
 *
 * Saving does not delete anything: the sweep does that on its next pass, and the
 * manual purge does it on request. Keeping the two separate means a mistyped
 * window can be corrected before any row is gone.
 */
export async function setAttributionRetention(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = attributionRetentionBodySchema.parse(rawBody);
  await attributionRetentionRepository.upsert(tx, {
    retentionDays: body.retentionDays,
    membershipId: ctx.actorMembershipId,
  });
  return await getAttributionRetention(tx, ctx);
}

/**
 * Runs the purge now, one batch.
 *
 * `moreRemaining` is the honest half: a first purge over years of history will
 * hit the batch limit, and a screen that reported "deleted 5,000" without
 * saying more are queued would look like it had finished.
 */
export async function purgeAttributionEventsNow(tx: TenantTx, _ctx: ServiceCtx) {
  const deleted = await purgeExpiredAttributionEvents(tx, PURGE_BATCH_LIMIT);
  return purgeAttributionEventsResponseSchema.parse({
    data: { deleted, moreRemaining: deleted >= PURGE_BATCH_LIMIT },
  });
}

/** A UTC midnight, `offset` days before today. */
function utcDayStart(offsetDays: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offsetDays, 0, 0, 0, 0),
  );
}

/**
 * Daily health of the attribution log.
 *
 * Every other surface in this area reports a single aggregate, which cannot
 * show the two failures that matter most: a beacon that stopped days ago, and
 * an attribution rate that collapsed on a particular day. A total hides both —
 * a log with 60,000 events looks healthy whether or not the last one arrived
 * this morning or last month.
 *
 * Days are UTC, and the screen says so: bucketing a marketing series in the
 * reader's local zone would put the same event in different days for two
 * colleagues comparing notes.
 */
export async function getAttributionHealth(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query = attributionHealthQuerySchema.parse(rawQuery);

  const [rows, eventTypes, summary] = await Promise.all([
    salesMarketingRepository.dailyAttributionHealth(tx, {
      days: query.days,
      skewToleranceSeconds: ATTRIBUTION_SKEW_TOLERANCE_SECONDS,
    }),
    salesMarketingRepository.attributionEventTypeHealth(tx, { days: query.days }),
    summariseAttributionEvents(tx, ctx, {}),
  ]);

  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), row]));

  // Zero-filled. A silent day must be a row reading zero, not an absent one:
  // a chart that skips the gap draws a continuous line straight through an
  // outage, which is the exact failure this screen exists to show.
  const series = Array.from({ length: query.days }, (_, index) => {
    const day = utcDayStart(query.days - 1 - index);
    const row = byDay.get(day.toISOString().slice(0, 10));
    return {
      day: day.toISOString(),
      total: Number(row?.total ?? 0),
      attributed: Number(row?.attributed ?? 0),
      revenueEvents: Number(row?.revenue_events ?? 0),
      skewed: Number(row?.skewed ?? 0),
    };
  });

  let trailingSilentDays = 0;
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if ((series[index]?.total ?? 0) > 0) break;
    trailingSilentDays += 1;
  }

  const lastEventAt = summary.data.lastOccurredAt;
  const silentDays =
    lastEventAt === null
      ? null
      : Math.max(0, Math.floor((Date.now() - Date.parse(lastEventAt)) / 86_400_000));

  return attributionHealthResponseSchema.parse({
    data: {
      days: query.days,
      since: utcDayStart(query.days - 1).toISOString(),
      series,
      windowTotal: series.reduce((sum, entry) => sum + entry.total, 0),
      windowAttributed: series.reduce((sum, entry) => sum + entry.attributed, 0),
      windowSkewed: series.reduce((sum, entry) => sum + entry.skewed, 0),
      lastEventAt,
      silentDays,
      trailingSilentDays,
      eventTypes: eventTypes.map((row) => ({
        eventType: row.event_type,
        total: Number(row.total),
        lastSeenAt: row.last_seen.toISOString(),
      })),
      skewToleranceSeconds: ATTRIBUTION_SKEW_TOLERANCE_SECONDS,
    },
  });
}

/**
 * The log scanned for faults, listing the offending events.
 *
 * The health screen counts some of the same faults. A count tells an operator
 * something is wrong; only a list tells them which events to look at, and three
 * of these kinds are detected nowhere else in the console at all — a
 * double-firing tag, a template published with its placeholder intact, and an
 * event dated in the future.
 *
 * `affectedTotal` is the sum across kinds and is deliberately not called
 * distinct: one event can be both future-dated and skewed, and pretending to
 * de-duplicate across five separate scans would be a number nothing computed.
 */
export async function getAttributionAnomalies(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = attributionAnomaliesQuerySchema.parse(rawQuery);

  const results = await Promise.all(
    ATTRIBUTION_ANOMALY_KINDS.map(async (kind) =>
      salesMarketingRepository.listAttributionAnomalies(tx, {
        kind,
        days: query.days,
        limit: ATTRIBUTION_ANOMALY_SAMPLE_LIMIT,
        skewSeconds: ATTRIBUTION_SKEW_TOLERANCE_SECONDS,
      }),
    ),
  );

  const groups = ATTRIBUTION_ANOMALY_KINDS.map((kind, index) => {
    const rows = results[index] ?? [];
    // The window function carries the true total on every row, so an empty
    // sample really does mean none rather than none-returned.
    const total = Number(rows[0]?.total ?? 0);
    return {
      kind,
      total,
      truncated: total > rows.length,
      items: rows.map((row) => ({
        ...toDto(row),
        createdAt: row.created_at.toISOString(),
        copies: row.copies === null ? null : Number(row.copies),
      })),
    };
  });

  return attributionAnomaliesResponseSchema.parse({
    data: {
      days: query.days,
      groups,
      affectedTotal: groups.reduce((sum, group) => sum + group.total, 0),
      sampleLimit: ATTRIBUTION_ANOMALY_SAMPLE_LIMIT,
      skewToleranceSeconds: ATTRIBUTION_SKEW_TOLERANCE_SECONDS,
    },
  });
}

/** Which rollup fields an event lacks. Named, not left to be inferred. */
function missingRollupFields(row: {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}): Array<"source" | "medium" | "campaign"> {
  const missing: Array<"source" | "medium" | "campaign"> = [];
  if (row.utm_source === null) missing.push("source");
  if (row.utm_medium === null) missing.push("medium");
  if (row.utm_campaign === null) missing.push("campaign");
  return missing;
}

/**
 * Events that cannot be credited to a campaign.
 *
 * Two kinds, kept apart because they have different causes and different fixes:
 * nothing at all usually means the link never carried parameters, while a
 * partial set usually means one field is missing from a link template. A single
 * "unattributed" number merges a marketing problem with a templating one.
 *
 * Partial attribution is detected nowhere else in this console. An event with a
 * source but no campaign is counted as *attributed* everywhere — it satisfies
 * the "any UTM field" test — while still landing in a breakdown row that reads
 * "(not set)" and comparing with nothing.
 *
 * Scanned across the window, not over a loaded page: a share of "the loaded
 * events" is a number about the screen rather than about the academy.
 */
export async function getAttributionGaps(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = attributionGapsQuerySchema.parse(rawQuery);

  const [counts, ...samples] = await Promise.all([
    salesMarketingRepository.countAttributionGaps(tx, { days: query.days }),
    ...ATTRIBUTION_GAP_KINDS.map(async (kind) =>
      salesMarketingRepository.listAttributionGaps(tx, {
        kind,
        days: query.days,
        limit: ATTRIBUTION_GAP_SAMPLE_LIMIT,
      }),
    ),
  ]);

  const groups = ATTRIBUTION_GAP_KINDS.map((kind, index) => {
    const rows = samples[index] ?? [];
    const total = Number(rows[0]?.total ?? 0);
    return {
      kind,
      total,
      truncated: total > rows.length,
      items: rows.map((row) => ({
        ...toDto(row),
        missing: missingRollupFields(row),
      })),
    };
  });

  return attributionGapsResponseSchema.parse({
    data: {
      days: query.days,
      groups,
      scannedTotal: Number(counts.scanned_total),
      // The two kinds are disjoint by construction — an event either carries
      // nothing or carries something — so this sum really is distinct events.
      affectedTotal: Number(counts.no_utm_total) + Number(counts.partial_total),
      missingSource: Number(counts.missing_source),
      missingMedium: Number(counts.missing_medium),
      missingCampaign: Number(counts.missing_campaign),
      revenueWithoutCurrency: Number(counts.revenue_without_currency),
      sampleLimit: ATTRIBUTION_GAP_SAMPLE_LIMIT,
    },
  });
}
