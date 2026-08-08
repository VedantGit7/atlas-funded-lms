import { z } from "zod";

const seasonalKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const SEASONAL_STATUSES = ["draft", "scheduled", "active", "ended"] as const;

export const seasonalMultiplierSchema = z
  .object({
    xpMultiplier: z.number().min(1).max(10),
    applyToStreakBonuses: z.boolean().default(true),
  })
  .strict();

export const seasonalEventDtoSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  status: z.enum(SEASONAL_STATUSES),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  multiplier: seasonalMultiplierSchema,
  linkedQuestIds: z.array(z.string().uuid()),
  linkedLeaderboardKey: z.string().nullable(),
});

export const createSeasonalEventInputSchema = z
  .object({
    key: seasonalKeySchema,
    name: z.string().min(1).max(160),
    status: z.enum(["draft", "scheduled"]).default("scheduled"),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    multiplier: seasonalMultiplierSchema,
    linkedQuestIds: z.array(z.string().uuid()).max(20).default([]),
    linkedLeaderboardKey: z.string().max(64).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.endsAt) <= new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endsAt must be after startsAt.",
        path: ["endsAt"],
      });
    }
  });

export const postSeasonalEventsBodySchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("create"),
      event: createSeasonalEventInputSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("clone"),
      id: z.string().uuid(),
      key: seasonalKeySchema,
      name: z.string().min(1).max(160),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
    })
    .strict(),
]);

export const updateSeasonalEventBodySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(160).optional(),
    status: z.enum(SEASONAL_STATUSES).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    multiplier: seasonalMultiplierSchema.optional(),
    linkedQuestIds: z.array(z.string().uuid()).max(20).optional(),
    linkedLeaderboardKey: z.string().max(64).nullable().optional(),
  })
  .strict();

export const seasonalEventsListResponseSchema = z.object({
  data: z.object({
    items: z.array(seasonalEventDtoSchema),
  }),
});

export const seasonalEventDetailResponseSchema = z.object({
  data: seasonalEventDtoSchema,
});

export const myActiveSeasonalEventResponseSchema = z.object({
  data: z.object({
    event: z
      .object({
        key: z.string(),
        name: z.string(),
        endsAt: z.string().datetime(),
        xpMultiplier: z.number(),
      })
      .nullable(),
  }),
});

export type SeasonalMultiplier = z.infer<typeof seasonalMultiplierSchema>;
export type SeasonalStatus = (typeof SEASONAL_STATUSES)[number];
