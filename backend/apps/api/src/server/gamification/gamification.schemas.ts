import { z } from "zod";
import { entityStatusSchema } from "../competency/competency-config.schemas";
import { GAMIFICATION_CONSUMED_EVENT_TYPES } from "./gamification-event.schemas";

const consumedEventTypeSchema = z.enum(GAMIFICATION_CONSUMED_EVENT_TYPES);
const ruleKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);

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
  .passthrough();

export const primitiveBadgeCriteriaSchema = z.discriminatedUnion("type", [
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

export const badgeCriteriaSchema = z.discriminatedUnion("type", [
  ...primitiveBadgeCriteriaSchema.options,
  z
    .object({
      type: z.literal("compound"),
      operator: z.enum(["all", "any"]),
      criteria: z.array(primitiveBadgeCriteriaSchema).min(1).max(5),
    })
    .strict(),
]);

export const leaderboardConfigSchema = z
  .object({
    scopeType: z.enum(["tenant", "course", "group"]),
    courseId: z.string().uuid().optional(),
    spaceId: z.string().uuid().optional(),
    privacyMode: z.literal("anonymous_rank"),
    maxEntries: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scopeType === "course" && !value.courseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "courseId is required when scopeType is course.",
        path: ["courseId"],
      });
    }
    if (value.scopeType === "group" && !value.spaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "spaceId is required when scopeType is group.",
        path: ["spaceId"],
      });
    }
    if (value.scopeType === "tenant" && (value.courseId || value.spaceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "courseId and spaceId must not be set when scopeType is tenant.",
        path: ["scopeType"],
      });
    }
    if (value.scopeType === "course" && value.spaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "spaceId must not be set when scopeType is course.",
        path: ["spaceId"],
      });
    }
    if (value.scopeType === "group" && value.courseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "courseId must not be set when scopeType is group.",
        path: ["courseId"],
      });
    }
  });

export const badgeDtoSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  iconKey: z.string().nullable(),
  criteria: badgeCriteriaSchema,
  status: entityStatusSchema,
  awarded: z.boolean().optional(),
  awardedAt: z.string().datetime().nullable().optional(),
});

export const gamificationLevelProgressDtoSchema = z.object({
  levelNumber: z.number().int(),
  levelKey: z.string(),
  currentLevelMinXp: z.number().int(),
  nextLevelKey: z.string().nullable(),
  nextLevelMinXp: z.number().int().nullable(),
  xpIntoLevel: z.number().int(),
  xpForNextLevel: z.number().int().nullable(),
  progressPct: z.number().int().min(0).max(100),
});

export const gamificationProfileDtoSchema = z.object({
  membershipId: z.string().uuid(),
  xpTotal: z.number().int(),
  levelKey: z.string().nullable(),
  badgeCount: z.number().int(),
  weeklyXp: z.number().int(),
  league: z.enum(["bronze", "silver", "gold"]).nullable(),
  // Weekly standing among ranked members (1 = top). Null when the learner has
  // no weekly XP yet, so callers can show an "unranked" state.
  weeklyRank: z.number().int().positive().nullable(),
  rankedMembers: z.number().int().nonnegative(),
  levelProgress: gamificationLevelProgressDtoSchema.nullable(),
});

export const badgeProgressResponseSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        id: z.string().uuid(),
        key: z.string(),
        name: z.string(),
        iconKey: z.string().nullable(),
        awarded: z.boolean(),
        awardedAt: z.string().datetime().nullable(),
        operator: z.enum(["all", "any"]),
        progress: z.array(
          z.object({
            criteria: primitiveBadgeCriteriaSchema,
            progress: z.number(),
            target: z.number(),
          }),
        ),
      }),
    ),
  }),
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

export const gamificationPublicConfigResponseSchema = z.object({
  data: z.object({
    leaderboardsPublic: z.boolean(),
  }),
});

export const gamificationXpRuleSchema = z
  .object({
    key: ruleKeySchema,
    eventType: consumedEventTypeSchema,
    points: z.number().int().min(0).max(10000),
    condition: z.literal("pass").optional(),
  })
  .strict();

export const gamificationLevelThresholdSchema = z
  .object({
    levelKey: ruleKeySchema,
    minXp: z.number().int().min(0),
  })
  .strict();

export const gamificationStreakRuleSchema = z
  .object({
    streakKey: ruleKeySchema,
    eventTypes: z.array(consumedEventTypeSchema).min(1).max(16),
    cadence: z.enum(["daily", "weekly"]).default("daily"),
    groupScoped: z.boolean().optional(),
  })
  .strict();

export const gamificationStreakBonusSchema = z
  .object({
    days: z.number().int().min(2).max(365),
    bonusXp: z.number().int().min(1).max(10000),
  })
  .strict();

function assertUnique(
  ctx: z.RefinementCtx,
  values: Array<string | number> | undefined,
  path: string,
  message: string,
): void {
  if (!values) return;
  if (new Set(values).size !== values.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
  }
}

// Read DTO is lenient (legacy tenant configs may reference event types outside the
// current taxonomy); the write schema below enforces the strict taxonomy.
export const gamificationRulesDtoSchema = z.object({
  xpRules: z.array(
    z.object({
      key: z.string(),
      eventType: z.string(),
      points: z.number().int(),
      condition: z.literal("pass").optional(),
    }),
  ),
  levelThresholds: z.array(
    z.object({
      levelKey: z.string(),
      minXp: z.number().int(),
    }),
  ),
  streaks: z.array(
    z.object({
      streakKey: z.string(),
      eventTypes: z.array(z.string()),
      cadence: z.enum(["daily", "weekly"]).optional(),
      groupScoped: z.boolean().optional(),
    }),
  ),
  defaultFreezeInventory: z.number().int(),
  leaderboardsPublic: z.boolean(),
  streakBonuses: z.array(
    z.object({
      days: z.number().int(),
      bonusXp: z.number().int(),
    }),
  ),
});

export const gamificationRulesResponseSchema = z.object({
  data: gamificationRulesDtoSchema,
});

export const updateGamificationRulesBodySchema = z
  .object({
    xpRules: z.array(gamificationXpRuleSchema).max(50).optional(),
    levelThresholds: z.array(gamificationLevelThresholdSchema).min(1).max(50).optional(),
    streaks: z.array(gamificationStreakRuleSchema).max(20).optional(),
    defaultFreezeInventory: z.number().int().min(0).max(10).optional(),
    leaderboardsPublic: z.boolean().optional(),
    streakBonuses: z.array(gamificationStreakBonusSchema).max(20).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    assertUnique(
      ctx,
      value.xpRules?.map((rule) => rule.key),
      "xpRules",
      "XP rule keys must be unique.",
    );
    assertUnique(
      ctx,
      value.levelThresholds?.map((threshold) => threshold.levelKey),
      "levelThresholds",
      "Level keys must be unique.",
    );
    assertUnique(
      ctx,
      value.levelThresholds?.map((threshold) => threshold.minXp),
      "levelThresholds",
      "Level thresholds must have distinct minimum XP values.",
    );
    assertUnique(
      ctx,
      value.streaks?.map((streak) => streak.streakKey),
      "streaks",
      "Streak keys must be unique.",
    );
    assertUnique(
      ctx,
      value.streakBonuses?.map((bonus) => bonus.days),
      "streakBonuses",
      "Streak bonus day milestones must be unique.",
    );
    if (value.levelThresholds && !value.levelThresholds.some((entry) => entry.minXp === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One level threshold must start at 0 XP.",
        path: ["levelThresholds"],
      });
    }
  })
  .and(rejectClientGamificationFields);

export const gamificationEventsResponseSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        eventType: z.string(),
        label: z.string(),
        status: z.enum(["active", "planned"]),
      }),
    ),
  }),
});

export const simulateBodySchema = z
  .object({
    membershipId: z.string().uuid(),
    eventType: consumedEventTypeSchema,
  })
  .strict();

export const simulateResponseSchema = z.object({
  data: z.object({
    eventType: z.string(),
    seasonalMultiplier: z.number(),
    xp: z.object({
      total: z.number().int(),
      entries: z.array(z.object({ ruleKey: z.string(), points: z.number().int() })),
    }),
    streaks: z.array(
      z.object({
        streakKey: z.string(),
        wouldAdvance: z.boolean(),
        projectedCount: z.number().int(),
        bonusXp: z.number().int(),
      }),
    ),
    badges: z.array(z.object({ key: z.string(), name: z.string() })),
    quests: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        stepsProgressed: z.number().int(),
        wouldComplete: z.boolean(),
      }),
    ),
  }),
});

export const gamificationExportResponseSchema = z.object({
  data: z.object({
    exportedAt: z.string().datetime(),
    rules: gamificationRulesDtoSchema,
    badges: z.array(z.record(z.string(), z.unknown())),
    leaderboards: z.array(z.record(z.string(), z.unknown())),
    quests: z.array(z.record(z.string(), z.unknown())),
    rewards: z.object({
      currencies: z.array(z.record(z.string(), z.unknown())),
      items: z.array(z.record(z.string(), z.unknown())),
    }),
    seasonalEvents: z.array(z.record(z.string(), z.unknown())),
  }),
});

export const myLedgerQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(200).optional(),
  })
  .strict();

export const myLedgerItemSchema = z.object({
  points: z.number().int(),
  reasonKey: z.string(),
  eventType: z.string().nullable(),
  occurredAt: z.string().datetime(),
});

export const myLedgerResponseSchema = z.object({
  data: z.object({
    items: z.array(myLedgerItemSchema),
    nextCursor: z.string().nullable(),
  }),
});

export const myActivityDaySchema = z.object({
  date: z.string(),
  xp: z.number().int(),
});

export const myActivityResponseSchema = z.object({
  data: z.object({
    timezone: z.string(),
    rangeStart: z.string(),
    rangeEnd: z.string(),
    totalXp: z.number().int(),
    activeDays: z.number().int(),
    maxDailyXp: z.number().int(),
    days: z.array(myActivityDaySchema),
  }),
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
    id: z.string().uuid(),
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
    badgeId: z.string().uuid(),
    membershipId: z.string().uuid(),
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

export const postBadgesManualAwardBulkBodySchema = z
  .object({
    operation: z.literal("manual_award_bulk"),
    badgeId: z.string().uuid(),
    membershipIds: z.array(z.string().uuid()).min(1).max(100),
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

export const postBadgesRevokeAwardBodySchema = z
  .object({
    operation: z.literal("revoke_award"),
    badgeId: z.string().uuid(),
    membershipId: z.string().uuid(),
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

export const postBadgesBodySchema = z.union([
  postBadgesCreateBodySchema,
  postBadgesManualAwardBodySchema,
  postBadgesManualAwardBulkBodySchema,
  postBadgesRevokeAwardBodySchema,
]);

export const manualAwardBulkResponseSchema = z.object({
  data: z.object({
    awarded: z.array(z.string().uuid()),
    skipped: z.array(z.string().uuid()),
    failures: z.array(
      z.object({
        membershipId: z.string().uuid(),
        reason: z.string(),
      }),
    ),
  }),
});

export const badgeAwardsQuerySchema = z
  .object({
    badgeId: z.string().uuid().optional(),
    membershipId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(200).optional(),
  })
  .strict();

export const badgeAwardListItemSchema = z.object({
  badgeId: z.string().uuid(),
  badgeKey: z.string(),
  badgeName: z.string(),
  membershipId: z.string().uuid(),
  memberLabel: z.string(),
  awardedAt: z.string().datetime(),
  manual: z.boolean(),
});

export const badgeAwardsListResponseSchema = z.object({
  data: z.object({
    items: z.array(badgeAwardListItemSchema),
    nextCursor: z.string().nullable(),
  }),
});

const statusCountsSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  draft: z.number().int(),
  inactive: z.number().int(),
  archived: z.number().int(),
});

export const gamificationMetricsResponseSchema = z.object({
  data: z.object({
    badges: statusCountsSchema,
    leaderboards: statusCountsSchema,
    awardsThisWeek: z.number().int(),
    activeStreaks: z.number().int(),
    memberProfiles: z.number().int(),
    xpThisWeek: z.number().int(),
  }),
});

export const leaderboardDefinitionDtoSchema = z.object({
  id: z.string().uuid(),
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
    calculatedAt: z.string().datetime(),
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
    id: z.string().uuid(),
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
  id: z.string().uuid(),
});

export const leaderboardDetailQuerySchema = z
  .object({
    league: z.enum(["bronze", "silver", "gold"]).optional(),
  })
  .strict();

export const hallOfFameConfigSchema = z
  .object({
    recognitionSpaceSlug: z.string().min(1).max(128).optional(),
    leaderboardKey: z.string().min(1).max(64).optional(),
  })
  .strict();

export const hallOfFameConfigResponseSchema = z.object({
  data: hallOfFameConfigSchema,
});

export const updateHallOfFameConfigBodySchema = hallOfFameConfigSchema;

export const openBadgeAssertionSchema = z.record(z.string(), z.unknown());

export const openBadgeAssertionResponseSchema = z.object({
  data: openBadgeAssertionSchema,
});

export const streakFreezeResponseSchema = z.object({
  data: streakDtoSchema,
});

export const badgeKeyParamsSchema = z.object({
  key: z.string().min(1).max(64),
});

export type BadgeCriteria = z.infer<typeof badgeCriteriaSchema>;
export type LeaderboardConfig = z.infer<typeof leaderboardConfigSchema>;
