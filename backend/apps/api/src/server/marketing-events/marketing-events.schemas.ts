import { z } from "zod";

export const marketingEventStatusSchema = z.enum(["DRAFT", "LIVE", "UNPUBLISHED"]);
export const marketingEventRegistrationSourceSchema = z.enum([
  "FORM",
  "WORKFLOW",
  "LINK",
  "ADMIN",
]);

export const marketingEventDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: marketingEventStatusSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  location: z.string().nullable(),
  linkUrl: z.string().nullable(),
  joinUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  reminderMinutesBefore: z.number().int().nullable(),
  registrationCount: z.number().int().nonnegative(),
  isPast: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketingEventRegistrationDtoSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  source: marketingEventRegistrationSourceSchema,
  contactId: z.string().uuid().nullable(),
  membershipId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export const marketingEventsListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "LIVE", "UNPUBLISHED", "PAST"]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const marketingEventsListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingEventDtoSchema),
    summary: z.object({
      liveCount: z.number().int().nonnegative(),
      draftCount: z.number().int().nonnegative(),
      unpublishedCount: z.number().int().nonnegative(),
      pastCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      totalRegistrations: z.number().int().nonnegative(),
      upcomingLiveCount: z.number().int().nonnegative(),
    }),
  }),
});

export const marketingEventResponseSchema = z.object({ data: marketingEventDtoSchema });

export const marketingEventRegistrationsListResponseSchema = z.object({
  data: z.object({ items: z.array(marketingEventRegistrationDtoSchema) }),
});

const optionalUrl = z.union([z.string().trim().url().max(2000), z.literal(""), z.null()]);

export const createMarketingEventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional().nullable(),
  })
  .strict();

export const updateMarketingEventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional().nullable(),
    location: z.string().trim().max(500).optional().nullable(),
    linkUrl: optionalUrl.optional(),
    joinUrl: optionalUrl.optional(),
    coverImageUrl: optionalUrl.optional(),
    reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
  })
  .strict();

export const deleteMarketingEventBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteMarketingEventResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const publicMarketingEventDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  location: z.string().nullable(),
  linkUrl: z.string().nullable(),
  joinUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
});

export const publicMarketingEventsListResponseSchema = z.object({
  data: z.object({ items: z.array(publicMarketingEventDtoSchema) }),
});

export const publicMarketingEventResponseSchema = z.object({
  data: publicMarketingEventDtoSchema,
});

export const registerPublicMarketingEventBodySchema = z
  .object({
    email: z.string().trim().email().max(320),
    name: z.string().trim().max(200).optional().nullable(),
    source: marketingEventRegistrationSourceSchema.optional().default("LINK"),
  })
  .strict();

export const registerPublicMarketingEventResponseSchema = z.object({
  data: z.object({
    registered: z.literal(true),
    eventId: z.string().uuid(),
    alreadyRegistered: z.boolean(),
  }),
});
