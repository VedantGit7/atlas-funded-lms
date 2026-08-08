import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type AttributionEventRow = {
  id: string;
  event_type: string;
  membership_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  revenue_cents: number | null;
  currency: string | null;
  occurred_at: Date;
};

function mapRow(row: Record<string, unknown>): AttributionEventRow {
  return {
    id: String(row["id"]),
    event_type: String(row["event_type"]),
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    utm_source: typeof row["utm_source"] === "string" ? row["utm_source"] : null,
    utm_medium: typeof row["utm_medium"] === "string" ? row["utm_medium"] : null,
    utm_campaign: typeof row["utm_campaign"] === "string" ? row["utm_campaign"] : null,
    revenue_cents: row["revenue_cents"] != null ? Number(row["revenue_cents"]) : null,
    currency: typeof row["currency"] === "string" ? row["currency"] : null,
    occurred_at: row["occurred_at"] as Date,
  };
}

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
      returning id, event_type, membership_id, utm_source, utm_medium, utm_campaign, revenue_cents, currency, occurred_at
    `;
    const row = rows[0];
    if (!row) throw new Error("ATTRIBUTION_EVENT_INSERT_FAILED");
    return mapRow(row);
  },

  async listEvents(
    tx: TenantTx,
    args: { eventType?: string; cursor?: string; limit: number },
  ): Promise<AttributionEventRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, event_type, membership_id, utm_source, utm_medium, utm_campaign, revenue_cents, currency, occurred_at
      from sales_attribution_events
      where (${args.eventType ?? null}::text is null or event_type = ${args.eventType ?? null})
        and (${args.cursor ?? null}::uuid is null or id < ${args.cursor ?? null}::uuid)
      order by occurred_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapRow);
  },
};
