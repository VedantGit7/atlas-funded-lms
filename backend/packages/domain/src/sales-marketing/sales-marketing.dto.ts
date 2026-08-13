import { z } from "zod";
import { pageInfoSchema, rejectClientTenantFields } from "../shared/domain.dto";

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

export const listAttributionEventsQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    eventType: z.string().max(64).optional(),
  })
  .strict();

export const attributionEventDtoSchema = z
  .object({
    id: z.uuid(),
    eventType: z.string(),
    membershipId: z.uuid().nullable(),
    utmSource: z.string().nullable(),
    utmMedium: z.string().nullable(),
    utmCampaign: z.string().nullable(),
    revenueCents: z.number().int().nullable(),
    currency: z.string().nullable(),
    occurredAt: z.iso.datetime(),
  })
  .strict();

export const createAttributionEventResponseSchema = z.object({
  data: attributionEventDtoSchema,
});

export const listAttributionEventsResponseSchema = z.object({
  data: z.object({
    items: z.array(attributionEventDtoSchema),
    pageInfo: pageInfoSchema,
  }),
});
