import { z } from "zod";
import { ENTITY_STATUSES, rejectClientTenantFields } from "../shared/domain.dto";

export const pollOptionInputSchema = z
  .object({
    label: z.string().min(1).max(256),
    sortOrder: z.number().int().min(0).default(0),
    isCorrect: z.boolean().default(false),
  })
  .strict();

export const createPollBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(512),
    description: z.string().max(4000).optional(),
    pollType: z.enum(["yes_no", "multiple_choice"]).default("multiple_choice"),
    status: z.enum(ENTITY_STATUSES).default("ACTIVE"),
    quizMode: z.boolean().default(false),
    allowMultipleAnswers: z.boolean().default(false),
    anonymousVote: z.boolean().default(false),
    resultVisibility: z.enum(["after_vote", "after_poll_ends"]).default("after_vote"),
    layout: z.enum(["list", "grid", "card"]).default("list"),
    durationSeconds: z.number().int().positive().max(86400).optional(),
    liveSessionId: z.string().uuid().optional(),
    closesAt: z.string().datetime().optional(),
    options: z.array(pollOptionInputSchema).min(1).max(20),
  })
  .strict();

export const updatePollBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(512).optional(),
    description: z.string().max(4000).nullable().optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
    quizMode: z.boolean().optional(),
    allowMultipleAnswers: z.boolean().optional(),
    anonymousVote: z.boolean().optional(),
    resultVisibility: z.enum(["after_vote", "after_poll_ends"]).optional(),
    layout: z.enum(["list", "grid", "card"]).optional(),
    durationSeconds: z.number().int().positive().max(86400).nullable().optional(),
    liveSessionId: z.string().uuid().nullable().optional(),
    closesAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const respondPollBodySchema = rejectClientTenantFields
  .extend({
    pollOptionId: z.string().uuid(),
  })
  .strict();

export const pollDtoSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    pollType: z.string(),
    status: z.enum(ENTITY_STATUSES),
    quizMode: z.boolean(),
    allowMultipleAnswers: z.boolean(),
    anonymousVote: z.boolean(),
    resultVisibility: z.string(),
    layout: z.string(),
    durationSeconds: z.number().int().nullable(),
    liveSessionId: z.string().uuid().nullable(),
    closesAt: z.string().datetime().nullable(),
    options: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        sortOrder: z.number().int(),
        isCorrect: z.boolean(),
      }),
    ),
    createdAt: z.string().datetime(),
  })
  .strict();

export const pollResponseSchema = z.object({ data: pollDtoSchema });
export const pollListResponseSchema = z.object({
  data: z.object({ items: z.array(pollDtoSchema) }),
});

export const pollResultsResponseSchema = z.object({
  data: z.object({
    pollId: z.string().uuid(),
    totalResponses: z.number().int(),
    options: z.array(
      z.object({
        optionId: z.string().uuid(),
        label: z.string(),
        count: z.number().int(),
        isCorrect: z.boolean(),
        percent: z.number(),
      }),
    ),
  }),
});

export const respondPollResponseSchema = z.object({
  data: z.object({
    pollId: z.string().uuid(),
    pollOptionId: z.string().uuid(),
    membershipId: z.string().uuid(),
  }),
});
