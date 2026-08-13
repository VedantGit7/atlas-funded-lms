import { z } from "zod";
import { entityStatusSchema } from "../competency/competency-config.schemas";

const rejectClientGamificationFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    membershipId: z.never().optional(),
    membership_id: z.never().optional(),
    xpTotal: z.never().optional(),
    xp_total: z.never().optional(),
    points: z.never().optional(),
    levelKey: z.never().optional(),
    level_key: z.never().optional(),
    sourceEventId: z.never().optional(),
    source_event_id: z.never().optional(),
  })
  .loose();

export const badgeCriteriaSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("xp_total"),
      minXp: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      type: z.literal("streak_current"),
      streakKey: z.string().min(1).max(64),
      minCount: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("event_count"),
      eventType: z.string().min(1).max(128),
      minCount: z.number().int().min(1),
    })
    .strict(),
]);

export const leaderboardConfigSchema = z
  .object({
    scopeType: z.enum(["tenant", "course"]),
    courseId: z.uuid().optional(),
    privacyMode: z.literal("anonymous_rank"),
    maxEntries: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scopeType === "course" && !value.courseId) {
      ctx.addIssue({
        code: "custom",
        message: "courseId is required when scopeType is course.",
        path: ["courseId"],
      });
    }
    if (value.scopeType === "tenant" && value.courseId) {
      ctx.addIssue({
        code: "custom",
        message: "courseId must not be set when scopeType is tenant.",
        path: ["courseId"],
      });
    }
  });

export const badgeDtoSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  iconKey: z.string().nullable(),
  criteria: badgeCriteriaSchema,
  status: entityStatusSchema,
  awarded: z.boolean().optional(),
  awardedAt: z.iso.datetime().nullable().optional(),
});

export const gamificationProfileDtoSchema = z.object({
  membershipId: z.uuid(),
  xpTotal: z.number().int(),
  levelKey: z.string().nullable(),
  badgeCount: z.number().int(),
});

export const streakDtoSchema = z.object({
  streakKey: z.string(),
  currentCount: z.number().int(),
  longestCount: z.number().int(),
  lastActivityDate: z.string().nullable(),
  availableFreezes: z.number().int(),
});

export const gamificationProfileResponseSchema = z.object({
  data: gamificationProfileDtoSchema,
});

export const streakListResponseSchema = z.object({
  data: z.object({
    items: z.array(streakDtoSchema),
  }),
});

export const badgeListResponseSchema = z.object({
  data: z.object({
    items: z.array(badgeDtoSchema),
  }),
});

export const badgeDetailResponseSchema = z.object({
  data: badgeDtoSchema,
});

export const createBadgeInputSchema = z
  .object({
    key: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    iconKey: z.string().min(1).max(64).optional(),
    criteria: badgeCriteriaSchema,
    status: entityStatusSchema.default("ACTIVE"),
  })
  .strict()
  .and(rejectClientGamificationFields);

export const updateBadgeBodySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(160).optional(),
    iconKey: z.string().min(1).max(64).nullable().optional(),
    criteria: badgeCriteriaSchema.optional(),
    status: entityStatusSchema.optional(),
  })
  .strict()
  .and(rejectClientGamificationFields);

export const postBadgesManualAwardBodySchema = z
  .object({
    operation: z.literal("manual_award"),
    badgeId: z.uuid(),
    membershipId: z.uuid(),
    reason: z.string().min(1).max(500),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    xpTotal: z.never().optional(),
    xp_total: z.never().optional(),
    points: z.never().optional(),
    levelKey: z.never().optional(),
    level_key: z.never().optional(),
    sourceEventId: z.never().optional(),
    source_event_id: z.never().optional(),
  })
  .strict();

export const postBadgesCreateBodySchema = z
  .object({
    operation: z.literal("create"),
    badge: createBadgeInputSchema,
  })
  .strict();

export const postBadgesBodySchema = z.union([
  postBadgesCreateBodySchema,
  postBadgesManualAwardBodySchema,
]);

export const leaderboardDefinitionDtoSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  metricKey: z.literal("xp_total"),
  windowKey: z.enum(["all_time", "weekly", "monthly"]),
  config: leaderboardConfigSchema,
  status: entityStatusSchema,
});

export const leaderboardListResponseSchema = z.object({
  data: z.object({
    items: z.array(leaderboardDefinitionDtoSchema),
  }),
});

export const sanitizedLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  label: z.string(),
  metricValue: z.number().int(),
  isSelf: z.boolean(),
});

export const leaderboardDetailResponseSchema = z.object({
  data: z.object({
    leaderboard: leaderboardDefinitionDtoSchema,
    periodKey: z.string(),
    calculatedAt: z.iso.datetime(),
    entries: z.array(sanitizedLeaderboardEntrySchema),
    callerRank: z.number().int().nullable(),
    callerMetricValue: z.number().int().nullable(),
  }),
});

export const createLeaderboardInputSchema = z
  .object({
    key: z.string().min(1).max(64),
    name: z.string().min(1).max(160),
    metricKey: z.literal("xp_total"),
    windowKey: z.enum(["all_time", "weekly", "monthly"]),
    config: leaderboardConfigSchema,
    status: entityStatusSchema.default("ACTIVE"),
  })
  .strict()
  .and(rejectClientGamificationFields);

export const updateLeaderboardBodySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(160).optional(),
    windowKey: z.enum(["all_time", "weekly", "monthly"]).optional(),
    config: leaderboardConfigSchema.optional(),
    status: entityStatusSchema.optional(),
  })
  .strict()
  .and(rejectClientGamificationFields);

export const postLeaderboardsBodySchema = z
  .object({
    operation: z.literal("create"),
    leaderboard: createLeaderboardInputSchema,
  })
  .strict()
  .and(rejectClientGamificationFields);

export const streakFreezeBodySchema = z.object({}).strict();

export const streakFreezeParamsSchema = z.object({
  key: z.string().min(1).max(64),
});

export const leaderboardIdParamsSchema = z.object({
  id: z.uuid(),
});

export const streakFreezeResponseSchema = z.object({
  data: streakDtoSchema,
});

export type BadgeCriteria = z.infer<typeof badgeCriteriaSchema>;
export type LeaderboardConfig = z.infer<typeof leaderboardConfigSchema>;
