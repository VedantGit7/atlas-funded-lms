import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createAttributionEventBodySchema,
  createAttributionEventResponseSchema,
  listAttributionEventsQuerySchema,
  listAttributionEventsResponseSchema,
} from "./sales-marketing.dto";
import { salesMarketingRepository, type AttributionEventRow } from "./sales-marketing.repository";

function toDto(row: AttributionEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    membershipId: row.membership_id,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
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
  const rows = await salesMarketingRepository.listEvents(tx, {
    limit: query.limit,
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(toDto);

  return listAttributionEventsResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}
