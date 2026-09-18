import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import {
  MAX_RETENTION_DAYS as ATTRIBUTION_MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS as ATTRIBUTION_MIN_RETENTION_DAYS,
} from "./attribution-retention";
import { ATTRIBUTION_ANOMALY_KINDS, ATTRIBUTION_GAP_KINDS } from "./sales-marketing.repository";

export const createAttributionEventBodySchema = rejectClientTenantFields
  .extend({
    eventType: z.string().min(1).max(64),
    membershipId: z.uuid().optional(),
    utmSource: z.string().max(128).optional(),
    utmMedium: z.string().max(128).optional(),
    utmCampaign: z.string().max(128).optional(),
    utmTerm: z.string().max(128).optional(),
    utmContent: z.string().max(128).optional(),
    revenueCents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
    occurredAt: z.iso.datetime().optional(),
  })
  .strict();

/**
 * Whether an event carried any campaign attribution at all.
 *
 * "none" is not the same as broken. A learner who types the address in has no
 * UTM parameters and never will — the value of separating them is that a sudden
 * rise in "none" is what a broken tracking link looks like.
 */
export const ATTRIBUTION_PRESENCE = ["any", "attributed", "none"] as const;

/** Filters shared by the event page and the aggregate over it. */
const attributionFilterShape = {
  eventType: z.string().max(64).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  attribution: z.enum(ATTRIBUTION_PRESENCE).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  /**
   * Exact narrowing on one axis, as opposed to `q`'s text search across all of
   * them. A breakdown row drilling into its own axis needs this, or the events
   * it opens are not the events it counted.
   */
  utmSource: z.string().trim().min(1).max(128).optional(),
  utmMedium: z.string().trim().min(1).max(128).optional(),
  utmCampaign: z.string().trim().min(1).max(128).optional(),
  /** "This axis was never set" — its own parameter, never a sentinel value. */
  utmSourceUnset: z.coerce.boolean().optional(),
  utmMediumUnset: z.coerce.boolean().optional(),
  utmCampaignUnset: z.coerce.boolean().optional(),
};

export const listAttributionEventsQuerySchema = rejectClientTenantFields
  .extend({
    /**
     * Opaque keyset cursor.
     *
     * Was a bare uuid compared with `id < cursor` against an `occurred_at desc`
     * ordering. Ids are random v4 UUIDs, so that comparison had nothing to do
     * with the ordering and silently dropped rows from page two onward.
     */
    cursor: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    ...attributionFilterShape,
  })
  .strict();

export const attributionSummaryQuerySchema = rejectClientTenantFields
  .extend(attributionFilterShape)
  .strict();

/**
 * The event log's own page info.
 *
 * The shared `pageInfoSchema` types `nextCursor` as a uuid, which is the
 * assumption that broke paging here in the first place.
 */
export const attributionEventPageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

/** How many distinct sources and event types a summary will name. */
export const ATTRIBUTION_BREAKDOWN_LIMIT = 12;

export const attributionSummaryResponseSchema = z.object({
  data: z.object({
    /** Every matching event, not the page the screen has loaded. */
    total: z.number().int().min(0),
    /** Carried at least one UTM field. */
    attributed: z.number().int().min(0),
    /** Carried none of the five UTM fields. */
    noUtm: z.number().int().min(0),
    revenueEvents: z.number().int().min(0),
    revenueByCurrency: z.array(
      z.object({
        currency: z.string(),
        amountCents: z.number().int(),
        events: z.number().int(),
      }),
    ),
    eventTypes: z.array(z.object({ eventType: z.string(), total: z.number().int() })),
    /** More distinct types than `eventTypes` names, if any. */
    eventTypeTotal: z.number().int().min(0),
    sources: z.array(
      z.object({
        source: z.string().nullable(),
        medium: z.string().nullable(),
        total: z.number().int(),
      }),
    ),
    sourceTotal: z.number().int().min(0),
    /** The window the figures actually describe. */
    firstOccurredAt: z.iso.datetime().nullable(),
    lastOccurredAt: z.iso.datetime().nullable(),
  }),
});

export const attributionEventDtoSchema = z
  .object({
    id: z.uuid(),
    eventType: z.string(),
    membershipId: z.uuid().nullable(),
    utmSource: z.string().nullable(),
    utmMedium: z.string().nullable(),
    utmCampaign: z.string().nullable(),
    /**
     * Carried by the list, not just the detail view.
     *
     * Both are written on create and were returned by nothing, so an event
     * attributed solely by one of them read as unattributed in the log, in the
     * row tint, and in the exported `attributed` column — while the server's
     * own summary counted it as attributed. The two now agree.
     */
    utmTerm: z.string().nullable(),
    utmContent: z.string().nullable(),
    revenueCents: z.number().int().nullable(),
    currency: z.string().nullable(),
    occurredAt: z.iso.datetime(),
  })
  .strict();

/**
 * The most rows one export may return.
 *
 * An export is a single response, not a paged read, so it needs a ceiling. The
 * response says whether it was reached rather than silently truncating — a
 * marketing export that quietly stops at row 10,000 is worse than one that
 * refuses.
 */
export const ATTRIBUTION_EXPORT_LIMIT = 10000;

/** The three axes an attribution breakdown can group by. */
export const ATTRIBUTION_DIMENSIONS = ["source", "medium", "campaign"] as const;

/** How many rows one breakdown returns, and how wide the cross-tab gets. */
export const ATTRIBUTION_GROUP_LIMIT_DEFAULT = 25;
export const ATTRIBUTION_MATRIX_AXIS_LIMIT = 8;

export const attributionBreakdownQuerySchema = attributionSummaryQuerySchema.extend({
  dimension: z.enum(ATTRIBUTION_DIMENSIONS).default("source"),
  limit: z.coerce.number().int().min(1).max(200).default(ATTRIBUTION_GROUP_LIMIT_DEFAULT),
});

const attributionRevenueSchema = z.object({
  currency: z.string(),
  amountCents: z.number().int(),
  events: z.number().int(),
});

const attributionGroupSchema = z.object({
  /** Null is a real group: the events that carried nothing on this axis. */
  value: z.string().nullable(),
  events: z.number().int().min(0),
  revenueEvents: z.number().int().min(0),
  revenueByCurrency: z.array(attributionRevenueSchema),
  /**
   * Revenue on this axis recorded with no currency.
   *
   * Cannot be added to any per-currency total, so it would otherwise vanish.
   */
  revenueWithoutCurrency: z.number().int().min(0),
  firstSeen: z.iso.datetime(),
  lastSeen: z.iso.datetime(),
});

export const attributionBreakdownResponseSchema = z.object({
  data: z.object({
    dimension: z.enum(ATTRIBUTION_DIMENSIONS),
    groups: z.array(attributionGroupSchema),
    /** Distinct values on this axis, whether or not they all fit in `groups`. */
    groupTotal: z.number().int().min(0),
    truncated: z.boolean(),
    /** Every matching event, so a share can be computed against a real total. */
    totalEvents: z.number().int().min(0),
    attributed: z.number().int().min(0),
    noUtm: z.number().int().min(0),
    distinctSources: z.number().int().min(0),
    distinctMediums: z.number().int().min(0),
    distinctCampaigns: z.number().int().min(0),
    revenueWithoutCurrency: z.number().int().min(0),
    matrix: z.object({
      sources: z.array(z.string().nullable()),
      mediums: z.array(z.string().nullable()),
      cells: z.array(
        z.object({
          source: z.string().nullable(),
          medium: z.string().nullable(),
          events: z.number().int().min(0),
        }),
      ),
      /** True when either axis holds more values than the cross-tab shows. */
      truncated: z.boolean(),
    }),
    firstOccurredAt: z.iso.datetime().nullable(),
    lastOccurredAt: z.iso.datetime().nullable(),
  }),
});

/** Same filters as the log, so an export matches what the operator was looking at. */
export const exportAttributionEventsQuerySchema = attributionSummaryQuerySchema;

export const exportAttributionEventsResponseSchema = z.object({
  data: z.object({
    items: z.array(attributionEventDtoSchema),
    /** How many events matched the filters in total. */
    totalCount: z.number().int().min(0),
    /** True when `totalCount` exceeds what this response carries. */
    truncated: z.boolean(),
    limit: z.number().int().min(1),
  }),
});

/**
 * Retention for the event log.
 *
 * `null` is the "keep everything" choice, not the absence of a choice — and it
 * is the default, because this log has history in live tenants and a finite
 * default would delete it on deploy.
 */
export const attributionRetentionBodySchema = rejectClientTenantFields
  .extend({
    retentionDays: z
      .number()
      .int()
      .min(ATTRIBUTION_MIN_RETENTION_DAYS)
      .max(ATTRIBUTION_MAX_RETENTION_DAYS)
      .nullable(),
  })
  .strict();

const attributionRetentionDtoSchema = z.object({
  retentionDays: z.number().int().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  updatedByName: z.string().nullable(),
  /** Every event currently held, so the impact figures have a denominator. */
  totalEvents: z.number().int().min(0),
  /** How many the current setting would delete on the next sweep. */
  deletableNow: z.number().int().min(0),
  oldestOccurredAt: z.iso.datetime().nullable(),
  minRetentionDays: z.number().int(),
  maxRetentionDays: z.number().int(),
});

export const attributionRetentionResponseSchema = z.object({
  data: attributionRetentionDtoSchema,
});

/** What a proposed window would delete, asked before anything is saved. */
export const attributionRetentionPreviewQuerySchema = rejectClientTenantFields
  .extend({
    retentionDays: z.coerce
      .number()
      .int()
      .min(ATTRIBUTION_MIN_RETENTION_DAYS)
      .max(ATTRIBUTION_MAX_RETENTION_DAYS)
      .optional(),
  })
  .strict();

export const attributionRetentionPreviewResponseSchema = z.object({
  data: z.object({
    retentionDays: z.number().int().nullable(),
    totalEvents: z.number().int().min(0),
    /** Deleted immediately if this window is saved and the sweep runs. */
    deletable: z.number().int().min(0),
    oldestOccurredAt: z.iso.datetime().nullable(),
  }),
});

export const purgeAttributionEventsResponseSchema = z.object({
  data: z.object({
    deleted: z.number().int().min(0),
    /** True when the batch limit was hit and more remain for the next pass. */
    moreRemaining: z.boolean(),
  }),
});

/**
 * How far apart an event's reported and recorded times may be before it counts
 * as skewed. Matches the tolerance the event detail screen uses.
 */
export const ATTRIBUTION_SKEW_TOLERANCE_SECONDS = 300;

export const ATTRIBUTION_HEALTH_MIN_DAYS = 7;
export const ATTRIBUTION_HEALTH_MAX_DAYS = 180;
export const ATTRIBUTION_HEALTH_DEFAULT_DAYS = 30;

export const attributionHealthQuerySchema = rejectClientTenantFields
  .extend({
    days: z.coerce
      .number()
      .int()
      .min(ATTRIBUTION_HEALTH_MIN_DAYS)
      .max(ATTRIBUTION_HEALTH_MAX_DAYS)
      .default(ATTRIBUTION_HEALTH_DEFAULT_DAYS),
  })
  .strict();

export const attributionHealthResponseSchema = z.object({
  data: z.object({
    days: z.number().int(),
    /** Inclusive UTC day the series starts on. */
    since: z.iso.datetime(),
    /**
     * One entry per day in the window, zero-filled.
     *
     * A silent day has to be a row reading zero, not an absent one: a chart
     * that skips the gap draws a continuous line through an outage.
     */
    series: z.array(
      z.object({
        day: z.iso.datetime(),
        total: z.number().int().min(0),
        attributed: z.number().int().min(0),
        revenueEvents: z.number().int().min(0),
        skewed: z.number().int().min(0),
      }),
    ),
    windowTotal: z.number().int().min(0),
    windowAttributed: z.number().int().min(0),
    windowSkewed: z.number().int().min(0),
    /** Newest event anywhere in the log, not just in the window. */
    lastEventAt: z.iso.datetime().nullable(),
    /** Whole days since that event; null when the log has never had one. */
    silentDays: z.number().int().min(0).nullable(),
    /** Consecutive zero days at the end of the window. */
    trailingSilentDays: z.number().int().min(0),
    eventTypes: z.array(
      z.object({
        eventType: z.string(),
        total: z.number().int().min(0),
        lastSeenAt: z.iso.datetime(),
      }),
    ),
    skewToleranceSeconds: z.number().int(),
  }),
});

/** How many offending events one kind lists. Counts are not capped. */
export const ATTRIBUTION_ANOMALY_SAMPLE_LIMIT = 25;

export const attributionAnomaliesQuerySchema = rejectClientTenantFields
  .extend({
    days: z.coerce
      .number()
      .int()
      .min(ATTRIBUTION_HEALTH_MIN_DAYS)
      .max(ATTRIBUTION_HEALTH_MAX_DAYS)
      .default(ATTRIBUTION_HEALTH_DEFAULT_DAYS),
  })
  .strict();

export const attributionAnomaliesResponseSchema = z.object({
  data: z.object({
    days: z.number().int(),
    groups: z.array(
      z.object({
        kind: z.enum(ATTRIBUTION_ANOMALY_KINDS),
        /** Every offending event of this kind in the window. */
        total: z.number().int().min(0),
        truncated: z.boolean(),
        items: z.array(
          attributionEventDtoSchema.extend({
            createdAt: z.iso.datetime(),
            /** Copies sharing this fingerprint; only set for duplicates. */
            copies: z.number().int().nullable(),
          }),
        ),
      }),
    ),
    /** Distinct offending events across all kinds is not derivable here. */
    affectedTotal: z.number().int().min(0),
    sampleLimit: z.number().int(),
    skewToleranceSeconds: z.number().int(),
  }),
});

/** How many events one gap kind lists. Counts are not capped. */
export const ATTRIBUTION_GAP_SAMPLE_LIMIT = 50;

export const attributionGapsQuerySchema = rejectClientTenantFields
  .extend({
    days: z.coerce
      .number()
      .int()
      .min(ATTRIBUTION_HEALTH_MIN_DAYS)
      .max(ATTRIBUTION_HEALTH_MAX_DAYS)
      .default(ATTRIBUTION_HEALTH_DEFAULT_DAYS),
  })
  .strict();

export const attributionGapsResponseSchema = z.object({
  data: z.object({
    days: z.number().int(),
    groups: z.array(
      z.object({
        kind: z.enum(ATTRIBUTION_GAP_KINDS),
        total: z.number().int().min(0),
        truncated: z.boolean(),
        items: z.array(
          attributionEventDtoSchema.extend({
            /**
             * Which rollup fields this event lacks.
             *
             * Named per row rather than left for the reader to infer from five
             * columns of nulls.
             */
            missing: z.array(z.enum(["source", "medium", "campaign"])),
          }),
        ),
      }),
    ),
    /** Every event in the window, so a share has a real denominator. */
    scannedTotal: z.number().int().min(0),
    /** Distinct events that cannot be fully credited. The two kinds are disjoint. */
    affectedTotal: z.number().int().min(0),
    /** Which field the partial events are missing — the actionable figure. */
    missingSource: z.number().int().min(0),
    missingMedium: z.number().int().min(0),
    missingCampaign: z.number().int().min(0),
    /**
     * Counted for the cross-link only.
     *
     * The offending rows are listed on the anomalies screen; a second list of
     * the same events here would be two views to keep in step for no gain.
     */
    revenueWithoutCurrency: z.number().int().min(0),
    sampleLimit: z.number().int(),
  }),
});

export const attributionEventParamsSchema = z
  .object({
    eventId: z.uuid(),
  })
  .strict();

/**
 * One event, in full.
 *
 * The list DTO carries every UTM field, so the two agree on whether an event was
 * attributed. What it still omits is the metadata blob the beacon posted and the
 * time the server actually recorded the row — a detail view exists to answer
 * those, and a gap between the recorded and reported times is only visible here.
 */
export const attributionEventDetailDtoSchema = attributionEventDtoSchema
  .extend({
    metadataJson: z.record(z.string(), z.unknown()).nullable(),
    /**
     * When the server wrote the row.
     *
     * Distinct from `occurredAt`, which the beacon supplies and can therefore
     * be wrong. A gap between the two is the signal that events were queued,
     * replayed, or posted with a bad clock.
     */
    createdAt: z.iso.datetime(),
  })
  .strict();

export const attributionEventResponseSchema = z.object({
  data: attributionEventDetailDtoSchema,
});

export const createAttributionEventResponseSchema = z.object({
  data: attributionEventDtoSchema,
});

export const listAttributionEventsResponseSchema = z.object({
  data: z.object({
    items: z.array(attributionEventDtoSchema),
    pageInfo: attributionEventPageInfoSchema,
  }),
});
