import { z } from "zod";
import { entityStatusSchema } from "../competency/competency-config.schemas";
import { GAMIFICATION_CONSUMED_EVENT_TYPES } from "./gamification-event.schemas";

const consumedEventTypeSchema = z.enum(GAMIFICATION_CONSUMED_EVENT_TYPES);

const questKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const questStepSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("complete_lessons"),
      count: z.number().int().min(1).max(1000),
      courseId: z.uuid().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("earn_xp"),
      amount: z.number().int().min(1).max(1000000),
    })
    .strict(),
  z
    .object({
      type: z.literal("maintain_streak"),
      streakKey: z.string().min(1).max(64),
      days: z.number().int().min(1).max(365),
    })
    .strict(),
  z
    .object({
      type: z.literal("earn_badge"),
      badgeKey: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      type: z.literal("complete_assessment"),
      minScorePercent: z.number().min(0).max(100),
      assessmentId: z.uuid().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("event_count"),
      eventType: consumedEventTypeSchema,
      count: z.number().int().min(1).max(1000),
    })
    .strict(),
]);

export const questCriteriaSchema = z
  .object({
    steps: z.array(questStepSchema).min(1).max(10),
  })
  .strict();

export const questRewardsSchema = z
  .object({
    xp: z.number().int().min(0).max(100000).optional(),
    badgeKey: z.string().min(1).max(64).optional(),
  })
  .strict();

export const questTypeSchema = z.enum(["single_step", "chain", "time_bound"]);

const rejectClientQuestFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    membershipId: z.never().optional(),
    membership_id: z.never().optional(),
    progressJson: z.never().optional(),
    progress_json: z.never().optional(),
  })
  .loose();

export const createQuestInputSchema = z
  .object({
    key: questKeySchema,
    name: z.string().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    questType: questTypeSchema.default("single_step"),
    criteria: questCriteriaSchema,
    rewards: questRewardsSchema.default({}),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    courseId: z.uuid().nullable().optional(),
    status: entityStatusSchema.default("ACTIVE"),
  })
  .strict()
  .and(rejectClientQuestFields);

export const postQuestsBodySchema = z
  .object({
    operation: z.literal("create"),
    quest: createQuestInputSchema,
  })
  .strict();

export const updateQuestBodySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    questType: questTypeSchema.optional(),
    criteria: questCriteriaSchema.optional(),
    rewards: questRewardsSchema.optional(),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    courseId: z.uuid().nullable().optional(),
    status: entityStatusSchema.optional(),
  })
  .strict()
  .and(rejectClientQuestFields);

export const questDtoSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  questType: z.string(),
  criteria: questCriteriaSchema,
  rewards: questRewardsSchema,
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  courseId: z.uuid().nullable(),
  status: entityStatusSchema,
});

export const questAdminListResponseSchema = z.object({
  data: z.object({
    items: z.array(
      questDtoSchema.extend({
        startedCount: z.number().int(),
        completedCount: z.number().int(),
      }),
    ),
  }),
});

export const questDetailResponseSchema = z.object({
  data: questDtoSchema,
});

export const questStepProgressSchema = z.object({
  progress: z.number(),
  target: z.number(),
  completedAt: z.iso.datetime().nullable(),
});

export const myQuestsResponseSchema = z.object({
  data: z.object({
    items: z.array(
      questDtoSchema.extend({
        progressStatus: z.enum(["not_started", "in_progress", "completed"]),
        stepProgress: z.array(questStepProgressSchema),
        completedAt: z.iso.datetime().nullable(),
      }),
    ),
  }),
});

export type QuestStep = z.infer<typeof questStepSchema>;
export type QuestCriteria = z.infer<typeof questCriteriaSchema>;
export type QuestRewards = z.infer<typeof questRewardsSchema>;
export type QuestStepProgress = z.infer<typeof questStepProgressSchema>;
