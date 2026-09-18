import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type AttributionEventRow = {
  id: string;
  event_type: string;
  membership_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  /**
   * All five UTM fields, not three.
   *
   * `utm_term` and `utm_content` were written on create and returned by
   * nothing, so an event attributed solely by one of them read as unattributed
   * in the log, in the row tint, and in the exported `attributed` column. Every
   * consumer of this row now sees what the server's own predicate sees.
   */
  utm_term: string | null;
  utm_content: string | null;
  revenue_cents: number | null;
  currency: string | null;
  occurred_at: Date;
};

/** The whole row, for the detail view. */
export type AttributionEventDetailRow = AttributionEventRow & {
  metadata_json: unknown;
  created_at: Date;
};

function mapRow(row: Record<string, unknown>): AttributionEventRow {
  return {
    id: String(row["id"]),
    event_type: String(row["event_type"]),
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    utm_source: typeof row["utm_source"] === "string" ? row["utm_source"] : null,
    utm_medium: typeof row["utm_medium"] === "string" ? row["utm_medium"] : null,
    utm_campaign: typeof row["utm_campaign"] === "string" ? row["utm_campaign"] : null,
    utm_term: typeof row["utm_term"] === "string" ? row["utm_term"] : null,
    utm_content: typeof row["utm_content"] === "string" ? row["utm_content"] : null,
    revenue_cents: row["revenue_cents"] != null ? Number(row["revenue_cents"]) : null,
    currency: typeof row["currency"] === "string" ? row["currency"] : null,
    occurred_at: row["occurred_at"] as Date,
  };
}

/** Filters shared by the event page and the aggregate over it. */
export type AttributionEventFilter = {
  eventType?: string;
  q?: string;
  attribution?: "any" | "attributed" | "none";
  from?: string;
  to?: string;
  /**
   * Exact narrowing on one axis.
   *
   * Distinct from `q`, which is a text search across every UTM field — so
   * searching "google" also matches a campaign named google. A breakdown row
   * drilling into its own axis needs the exact form, or the events it opens are
   * not the events it counted.
   */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /**
   * "This axis was never set", as its own parameter.
   *
   * Not a sentinel value: a campaign can legitimately be named anything a
   * sentinel might use, and `attribution=none` is a different question — it
   * means all five fields are absent, not that this one is.
   */
  utmSourceUnset?: boolean;
  utmMediumUnset?: boolean;
  utmCampaignUnset?: boolean;
};

/** The tuple the log is ordered by, and therefore paged by. */
export type AttributionCursor = { occurredAt: string; id: string };

/**
 * The anomaly kinds the log can be scanned for.
 *
 * Each is a fault that produces a wrong number somewhere downstream rather than
 * a merely unusual row — an anomalies screen that flags ordinary variation gets
 * ignored, and then so does the one real finding in it.
 */
/**
 * What an uninterpolated template placeholder looks like when it arrives.
 *
 * Upper-cased so the encoded form matches whichever case the browser produced,
 * and bound as parameters so no escaping layer can mangle them.
 */
const PLACEHOLDER_NEEDLES = ["{{", "${", "%7B%7B"];

export const ATTRIBUTION_ANOMALY_KINDS = [
  "duplicate",
  "unrendered-placeholder",
  "future-dated",
  "clock-skew",
  "revenue-without-currency",
] as const;

export type AttributionAnomalyKind = (typeof ATTRIBUTION_ANOMALY_KINDS)[number];

/** The three axes an attribution breakdown can group by. */
export type AttributionDimension = "source" | "medium" | "campaign";

/**
 * One `(value, currency)` bucket from a dimension scan.
 *
 * Split by currency so revenue can be reported per currency; the event counts
 * across a value's currency buckets sum to that value's total.
 */
export type AttributionGroupRow = {
  value: string | null;
  currency: string | null;
  total: bigint;
  revenue_events: bigint;
  revenue_cents: bigint;
  first_seen: Date;
  last_seen: Date;
};

/** Distinct-value counts across all three axes, from one scan. */
export type AttributionDimensionCountsRow = {
  distinct_sources: bigint;
  distinct_mediums: bigint;
  distinct_campaigns: bigint;
  /**
   * Revenue recorded without a currency.
   *
   * A real fault: the amount cannot be added to any total, so it silently
   * vanishes from every per-currency figure on this screen.
   */
  revenue_without_currency: bigint;
};

/**
 * The two ways an event fails to be creditable to a campaign.
 *
 * "None" and "some" are different problems with different causes: nothing at
 * all usually means the link never carried parameters, while a partial set
 * usually means the link template is missing a field. Merging them into one
 * "unattributed" number hides which one an operator is actually looking at.
 */
export const ATTRIBUTION_GAP_KINDS = ["no-utm", "partial"] as const;

export type AttributionGapKind = (typeof ATTRIBUTION_GAP_KINDS)[number];

/** How many partial events are missing each rollup field. */
export type AttributionMissingFieldRow = {
  missing_source: bigint;
  missing_medium: bigint;
  missing_campaign: bigint;
  partial_total: bigint;
  no_utm_total: bigint;
  scanned_total: bigint;
  revenue_without_currency: bigint;
};

/** One offending event, with the total for its kind carried alongside. */
export type AttributionAnomalyRow = {
  id: string;
  membership_id: string | null;
  event_type: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  // Carried because the placeholder scan reads them: a template published with
  // its placeholder intact is just as likely to land in utm_term as in source.
  utm_term: string | null;
  utm_content: string | null;
  revenue_cents: number | null;
  currency: string | null;
  occurred_at: Date;
  created_at: Date;
  /** How many events of this kind exist in the window, not just in the sample. */
  total: bigint;
  /** Set for duplicates: how many copies share the same fingerprint. */
  copies: bigint | null;
};

/** One UTC day of the health series. Days with no events are absent here. */
export type AttributionDailyRow = {
  day: Date;
  total: bigint;
  attributed: bigint;
  revenue_events: bigint;
  skewed: bigint;
};

/** When each event type was last seen, for spotting a funnel stage that stopped. */
export type AttributionEventTypeHealthRow = {
  event_type: string;
  total: bigint;
  last_seen: Date;
};

/** One `(source, medium)` cell of the cross-tab. */
export type AttributionMatrixRow = {
  utm_source: string | null;
  utm_medium: string | null;
  total: bigint;
};

/** One `(event_type, source, medium, currency)` bucket from the summary scan. */
export type AttributionSummaryRow = {
  event_type: string;
  utm_source: string | null;
  utm_medium: string | null;
  currency: string | null;
  total: bigint;
  revenue_events: bigint;
  revenue_cents: bigint;
  no_utm: bigint;
  first_occurred_at: Date;
  last_occurred_at: Date;
};

export const salesMarketingRepository = {
  async insertEvent(
    tx: TenantTx,
    args: {
      eventType: string;
      membershipId?: string | null;
      utmSource?: string | null;
      utmMedium?: string | null;
      utmCampaign?: string | null;
      utmTerm?: string | null;
      utmContent?: string | null;
      revenueCents?: number | null;
      currency?: string | null;
      metadataJson?: unknown;
      occurredAt?: Date;
    },
  ): Promise<AttributionEventRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into sales_attribution_events (
        id, tenant_id, membership_id, event_type,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        revenue_cents, currency, metadata_json, occurred_at, created_at, updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.membershipId ?? null}::uuid,
        ${args.eventType},
        ${args.utmSource ?? null},
        ${args.utmMedium ?? null},
        ${args.utmCampaign ?? null},
        ${args.utmTerm ?? null},
        ${args.utmContent ?? null},
        ${args.revenueCents ?? null},
        ${args.currency ?? null},
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        coalesce(${args.occurredAt ?? null}::timestamptz, now()),
        now(),
        now()
      )
      returning id, event_type, membership_id, utm_source, utm_medium, utm_campaign,
        utm_term, utm_content, revenue_cents, currency, occurred_at
    `;
    const row = rows[0];
    if (!row) throw new Error("ATTRIBUTION_EVENT_INSERT_FAILED");
    return mapRow(row);
  },

  /**
   * One page of events, newest first.
   *
   * The cursor is a row value over `(occurred_at, id)` — the same tuple the
   * ordering uses. Comparing `id` alone against a time ordering, as this did,
   * drops rows whose random uuid happens to sort the wrong way.
   */
  async listEvents(
    tx: TenantTx,
    args: AttributionEventFilter & { cursor?: AttributionCursor; limit: number },
  ): Promise<AttributionEventRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, event_type, membership_id, utm_source, utm_medium, utm_campaign,
        utm_term, utm_content, revenue_cents, currency, occurred_at
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
        and (
          ${args.cursor?.occurredAt ?? null}::timestamptz is null
          or (occurred_at, id) <
             (${args.cursor?.occurredAt ?? null}::timestamptz, ${args.cursor?.id ?? null}::uuid)
        )
      order by occurred_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapRow);
  },

  /**
   * Every event matching the filter, up to a ceiling.
   *
   * Deliberately not the paged read: an export that walked the cursor would
   * make one request per fifty rows and could interleave with the beacon
   * writing a new event, producing a file that is neither one snapshot nor the
   * other. The predicate is repeated from `listEvents` for the reason given
   * there.
   */
  async exportEvents(
    tx: TenantTx,
    args: AttributionEventFilter & { limit: number },
  ): Promise<AttributionEventRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, event_type, membership_id, utm_source, utm_medium, utm_campaign,
        utm_term, utm_content, revenue_cents, currency, occurred_at
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
      order by occurred_at desc, id desc
      limit ${args.limit}
    `;
    return rows.map(mapRow);
  },

  /**
   * One event by id, with the columns the list does not carry.
   *
   * RLS scopes this to the tenant, so a valid id belonging to somebody else
   * returns nothing rather than another tenant's event.
   */
  async findEventById(tx: TenantTx, eventId: string): Promise<AttributionEventDetailRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        id, event_type, membership_id, utm_source, utm_medium, utm_campaign,
        utm_term, utm_content, metadata_json, revenue_cents, currency,
        occurred_at, created_at
      from sales_attribution_events
      where id = ${eventId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      ...mapRow(row),
      metadata_json: row["metadata_json"] ?? null,
      created_at: row["created_at"] as Date,
    };
  },

  /**
   * Events that cannot be credited to a campaign, by kind.
   *
   * Scanned across the window rather than over a loaded page — a worklist built
   * from the fifty rows a screen happened to fetch reports a share of "the
   * loaded events", which is a number about the screen rather than about the
   * academy.
   */
  async listAttributionGaps(
    tx: TenantTx,
    args: { kind: AttributionGapKind; days: number; limit: number },
  ): Promise<AttributionAnomalyRow[]> {
    if (args.kind === "no-utm") {
      return await tx.$queryRaw<AttributionAnomalyRow[]>`
        select
          id::text, membership_id::text, event_type,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          revenue_cents, currency, occurred_at, created_at,
          count(*) over ()::bigint as total, null::bigint as copies
        from sales_attribution_events
        where occurred_at >= now() - make_interval(days => ${args.days})
          and utm_source is null and utm_medium is null and utm_campaign is null
          and utm_term is null and utm_content is null
        order by occurred_at desc
        limit ${args.limit}
      `;
    }

    // Something arrived, but not enough to group by. The rollups need source,
    // medium and campaign; an event carrying only one of them lands in a
    // breakdown row that reads "(not set)" and cannot be compared with anything.
    return await tx.$queryRaw<AttributionAnomalyRow[]>`
      select
        id::text, membership_id::text, event_type,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        revenue_cents, currency, occurred_at, created_at,
        count(*) over ()::bigint as total, null::bigint as copies
      from sales_attribution_events
      where occurred_at >= now() - make_interval(days => ${args.days})
        and (
          utm_source is not null or utm_medium is not null or utm_campaign is not null
          or utm_term is not null or utm_content is not null
        )
        and (utm_source is null or utm_medium is null or utm_campaign is null)
      order by occurred_at desc
      limit ${args.limit}
    `;
  },

  /**
   * Which rollup field the partial events are missing.
   *
   * The most actionable figure on the screen: "412 missing campaign" points at
   * one field of one link template, where a bare "412 partially attributed"
   * only says something is wrong.
   */
  async countAttributionGaps(
    tx: TenantTx,
    args: { days: number },
  ): Promise<AttributionMissingFieldRow> {
    const rows = await tx.$queryRaw<AttributionMissingFieldRow[]>`
      with windowed as (
        select *
        from sales_attribution_events
        where occurred_at >= now() - make_interval(days => ${args.days})
      ),
      partial as (
        select *
        from windowed
        where (
            utm_source is not null or utm_medium is not null or utm_campaign is not null
            or utm_term is not null or utm_content is not null
          )
          and (utm_source is null or utm_medium is null or utm_campaign is null)
      )
      select
        (select count(*) filter (where utm_source is null) from partial)::bigint as missing_source,
        (select count(*) filter (where utm_medium is null) from partial)::bigint as missing_medium,
        (select count(*) filter (where utm_campaign is null) from partial)::bigint
          as missing_campaign,
        (select count(*) from partial)::bigint as partial_total,
        (
          select count(*) from windowed
          where utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
        )::bigint as no_utm_total,
        (select count(*) from windowed)::bigint as scanned_total,
        (
          select count(*) from windowed
          where revenue_cents is not null and currency is null
        )::bigint as revenue_without_currency
    `;
    return (
      rows[0] ?? {
        missing_source: 0n,
        missing_medium: 0n,
        missing_campaign: 0n,
        partial_total: 0n,
        no_utm_total: 0n,
        scanned_total: 0n,
        revenue_without_currency: 0n,
      }
    );
  },

  /**
   * Events matching one anomaly kind, with the kind's total.
   *
   * Branched rather than interpolated: each kind is a different predicate, and
   * a predicate is not a bind parameter. The window function carries the true
   * total alongside a bounded sample, so the screen can say "12 of 340" without
   * a second round trip.
   *
   * These list the offending rows. The health screen counts some of the same
   * faults; a count tells an operator something is wrong, and only a list tells
   * them which events to look at.
   */
  async listAttributionAnomalies(
    tx: TenantTx,
    args: { kind: AttributionAnomalyKind; days: number; limit: number; skewSeconds: number },
  ): Promise<AttributionAnomalyRow[]> {
    if (args.kind === "future-dated") {
      return await tx.$queryRaw<AttributionAnomalyRow[]>`
        select
          id::text, membership_id::text, event_type,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          revenue_cents, currency, occurred_at, created_at,
          count(*) over ()::bigint as total, null::bigint as copies
        from sales_attribution_events
        where occurred_at > now()
        order by occurred_at desc
        limit ${args.limit}
      `;
    }

    if (args.kind === "clock-skew") {
      return await tx.$queryRaw<AttributionAnomalyRow[]>`
        select
          id::text, membership_id::text, event_type,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          revenue_cents, currency, occurred_at, created_at,
          count(*) over ()::bigint as total, null::bigint as copies
        from sales_attribution_events
        where occurred_at >= now() - make_interval(days => ${args.days})
          and abs(extract(epoch from (created_at - occurred_at))) > ${args.skewSeconds}
        order by abs(extract(epoch from (created_at - occurred_at))) desc
        limit ${args.limit}
      `;
    }

    if (args.kind === "revenue-without-currency") {
      return await tx.$queryRaw<AttributionAnomalyRow[]>`
        select
          id::text, membership_id::text, event_type,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          revenue_cents, currency, occurred_at, created_at,
          count(*) over ()::bigint as total, null::bigint as copies
        from sales_attribution_events
        where occurred_at >= now() - make_interval(days => ${args.days})
          and revenue_cents is not null
          and currency is null
        order by occurred_at desc
        limit ${args.limit}
      `;
    }

    if (args.kind === "unrendered-placeholder") {
      // A template that never interpolated: the tag was published with its
      // placeholder intact, so the campaign it was meant to name is
      // unattributable and every rollup silently gains a fake source.
      //
      // Matched with bound needles rather than a regex literal. A pattern
      // written inline would pass through a TypeScript template literal on its
      // way here, where a brace escape is stripped and a dollar-brace starts an
      // interpolation — the encoded form silently stopped matching that way.
      return await tx.$queryRaw<AttributionAnomalyRow[]>`
        select
          id::text, membership_id::text, event_type,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          revenue_cents, currency, occurred_at, created_at,
          count(*) over ()::bigint as total, null::bigint as copies
        from sales_attribution_events
        where occurred_at >= now() - make_interval(days => ${args.days})
          and exists (
            select 1
            from unnest(array[
              utm_source, utm_medium, utm_campaign, utm_term, utm_content
            ]) as field(value)
            cross join unnest(${PLACEHOLDER_NEEDLES}::text[]) as needle(token)
            where field.value is not null
              and strpos(upper(field.value), needle.token) > 0
          )
        order by occurred_at desc
        limit ${args.limit}
      `;
    }

    // Duplicates: the same learner, the same event type, the same instant.
    // A tag manager firing twice inflates every count downstream, and nothing
    // else in this console would ever show it.
    return await tx.$queryRaw<AttributionAnomalyRow[]>`
      with fingerprints as (
        select
          membership_id, event_type, occurred_at,
          count(*)::bigint as copies
        from sales_attribution_events
        where occurred_at >= now() - make_interval(days => ${args.days})
          and membership_id is not null
        group by membership_id, event_type, occurred_at
        having count(*) > 1
      )
      select
        e.id::text, e.membership_id::text, e.event_type,
        e.utm_source, e.utm_medium, e.utm_campaign, e.utm_term, e.utm_content,
        e.revenue_cents, e.currency, e.occurred_at, e.created_at,
        (select coalesce(sum(f.copies), 0) from fingerprints f)::bigint as total,
        f.copies
      from fingerprints f
      join sales_attribution_events e
        on e.membership_id = f.membership_id
       and e.event_type = f.event_type
       and e.occurred_at = f.occurred_at
      order by f.copies desc, e.occurred_at desc
      limit ${args.limit}
    `;
  },

  /**
   * Daily counts over a window, for the health series.
   *
   * Bucketed in UTC and returned sparse — a day with no events produces no row
   * at all, and the caller fills the gap. That is deliberate: a missing day and
   * a zero day are the same fact, and inventing the row in SQL would hide which
   * days the database actually had nothing for.
   *
   * `skewed` counts events whose reported time and recorded time disagree by
   * more than the tolerance. A cluster of those means events were queued or
   * replayed, which moves them into the wrong reporting day.
   */
  async dailyAttributionHealth(
    tx: TenantTx,
    args: { days: number; skewToleranceSeconds: number },
  ): Promise<AttributionDailyRow[]> {
    return await tx.$queryRaw<AttributionDailyRow[]>`
      select
        date_trunc('day', occurred_at at time zone 'UTC') as day,
        count(*)::bigint as total,
        count(*) filter (
          where utm_source is not null or utm_medium is not null or utm_campaign is not null
            or utm_term is not null or utm_content is not null
        )::bigint as attributed,
        count(*) filter (where revenue_cents is not null)::bigint as revenue_events,
        count(*) filter (
          where abs(extract(epoch from (created_at - occurred_at)))
                > ${args.skewToleranceSeconds}
        )::bigint as skewed
      from sales_attribution_events
      where occurred_at >= date_trunc('day', now() at time zone 'UTC')
                          - make_interval(days => ${args.days - 1})
      group by 1
      order by 1 asc
    `;
  },

  /**
   * Each event type in the window, with when it was last seen.
   *
   * A funnel stage that silently stops — signups still arriving, purchases not —
   * is invisible in a total and obvious here.
   */
  async attributionEventTypeHealth(
    tx: TenantTx,
    args: { days: number },
  ): Promise<AttributionEventTypeHealthRow[]> {
    return await tx.$queryRaw<AttributionEventTypeHealthRow[]>`
      select
        event_type,
        count(*)::bigint as total,
        max(occurred_at) as last_seen
      from sales_attribution_events
      where occurred_at >= now() - make_interval(days => ${args.days})
      group by event_type
      order by count(*) desc
    `;
  },

  /**
   * Every distinct value on one axis, with its counts, revenue and lifespan.
   *
   * Branched rather than interpolated: the group-by column differs per
   * dimension and a column name is not a bind parameter. Deliberately the whole
   * log rather than a loaded page — a breakdown assembled from fifty rows tells
   * an operator which campaign is winning based on whichever fifty events the
   * screen happened to fetch.
   */
  async groupEventsByDimension(
    tx: TenantTx,
    args: AttributionEventFilter & { dimension: AttributionDimension },
  ): Promise<AttributionGroupRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    if (args.dimension === "source") {
      return await tx.$queryRaw<AttributionGroupRow[]>`
        select
          utm_source as value,
          currency,
        count(*)::bigint as total,
        count(*) filter (where revenue_cents is not null)::bigint as revenue_events,
        coalesce(sum(revenue_cents), 0)::bigint as revenue_cents,
        min(occurred_at) as first_seen,
        max(occurred_at) as last_seen
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
        group by utm_source, currency
      `;
    }
    if (args.dimension === "medium") {
      return await tx.$queryRaw<AttributionGroupRow[]>`
        select
          utm_medium as value,
          currency,
        count(*)::bigint as total,
        count(*) filter (where revenue_cents is not null)::bigint as revenue_events,
        coalesce(sum(revenue_cents), 0)::bigint as revenue_cents,
        min(occurred_at) as first_seen,
        max(occurred_at) as last_seen
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
        group by utm_medium, currency
      `;
    }
    return await tx.$queryRaw<AttributionGroupRow[]>`
      select
        utm_campaign as value,
        currency,
        count(*)::bigint as total,
        count(*) filter (where revenue_cents is not null)::bigint as revenue_events,
        coalesce(sum(revenue_cents), 0)::bigint as revenue_cents,
        min(occurred_at) as first_seen,
        max(occurred_at) as last_seen
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
      group by utm_campaign, currency
    `;
  },

  /**
   * Distinct-value counts across all three axes, plus one data-quality figure.
   *
   * One scan rather than three, so the three numbers on the signal band cannot
   * disagree with each other the way separate queries against a table the
   * beacon is still writing to can.
   */
  async countAttributionDimensions(
    tx: TenantTx,
    args: AttributionEventFilter,
  ): Promise<AttributionDimensionCountsRow> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    const rows = await tx.$queryRaw<AttributionDimensionCountsRow[]>`
      select
        count(distinct utm_source)::bigint as distinct_sources,
        count(distinct utm_medium)::bigint as distinct_mediums,
        count(distinct utm_campaign)::bigint as distinct_campaigns,
        count(*) filter (
          where revenue_cents is not null and currency is null
        )::bigint as revenue_without_currency
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
    `;
    return (
      rows[0] ?? {
        distinct_sources: 0n,
        distinct_mediums: 0n,
        distinct_campaigns: 0n,
        revenue_without_currency: 0n,
      }
    );
  },

  /**
   * The source-by-medium cross-tab.
   *
   * Source and medium are only meaningful together — `google / cpc` and
   * `google / organic` are different acquisition channels that a
   * single-dimension table collapses into one row.
   */
  async crossTabSourceMedium(
    tx: TenantTx,
    args: AttributionEventFilter,
  ): Promise<AttributionMatrixRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    return await tx.$queryRaw<AttributionMatrixRow[]>`
      select utm_source, utm_medium, count(*)::bigint as total
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
      group by utm_source, utm_medium
    `;
  },

  /**
   * One grouped scan behind every figure the summary reports.
   *
   * Deliberately a single query rather than one per statistic: three separate
   * aggregates against a table the beacon is still writing to can disagree with
   * each other, and a screen that says "50 events, 8 without UTM, 45 attributed"
   * is worse than one that says nothing. The predicate is repeated from
   * `listEvents` verbatim; a test asserts the two agree.
   */
  async summariseEvents(
    tx: TenantTx,
    args: AttributionEventFilter,
  ): Promise<AttributionSummaryRow[]> {
    const like = args.q === undefined ? null : `%${args.q}%`;
    return await tx.$queryRaw<AttributionSummaryRow[]>`
      select
        event_type,
        utm_source,
        utm_medium,
        currency,
        count(*)::bigint as total,
        count(*) filter (where revenue_cents is not null)::bigint as revenue_events,
        coalesce(sum(revenue_cents), 0)::bigint as revenue_cents,
        count(*) filter (
          where utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
        )::bigint as no_utm,
        min(occurred_at) as first_occurred_at,
        max(occurred_at) as last_occurred_at
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.from ?? null}::timestamptz is null or occurred_at >= ${args.from ?? null}::timestamptz)
        and (${args.to ?? null}::timestamptz is null or occurred_at <= ${args.to ?? null}::timestamptz)
        and (
          ${args.attribution ?? null}::text is null
          or ${args.attribution ?? null} = 'any'
          or (
            ${args.attribution ?? null} = 'none'
            and utm_source is null and utm_medium is null and utm_campaign is null
            and utm_term is null and utm_content is null
          )
          or (
            ${args.attribution ?? null} = 'attributed'
            and (
              utm_source is not null or utm_medium is not null or utm_campaign is not null
              or utm_term is not null or utm_content is not null
            )
          )
        )
        and (
          ${like}::text is null
          or event_type ilike ${like}
          or utm_source ilike ${like}
          or utm_medium ilike ${like}
          or utm_campaign ilike ${like}
        )
        and (${args.utmSource ?? null}::text is null or utm_source = ${args.utmSource ?? null})
        and (${args.utmSourceUnset ?? null}::boolean is not true or utm_source is null)
        and (${args.utmMedium ?? null}::text is null or utm_medium = ${args.utmMedium ?? null})
        and (${args.utmMediumUnset ?? null}::boolean is not true or utm_medium is null)
        and (
          ${args.utmCampaign ?? null}::text is null
          or utm_campaign = ${args.utmCampaign ?? null}
        )
        and (${args.utmCampaignUnset ?? null}::boolean is not true or utm_campaign is null)
      group by event_type, utm_source, utm_medium, currency
    `;
  },
};
