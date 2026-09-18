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
    liveSessionId: z.uuid().optional(),
    closesAt: z.iso.datetime().optional(),
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
    liveSessionId: z.uuid().nullable().optional(),
    closesAt: z.iso.datetime().nullable().optional(),
  })
  .strict();

export const respondPollBodySchema = rejectClientTenantFields
  .extend({
    pollOptionId: z.uuid(),
  })
  .strict();

export const pollDtoSchema = z
  .object({
    id: z.uuid(),
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
    liveSessionId: z.uuid().nullable(),
    closesAt: z.iso.datetime().nullable(),
    options: z.array(
      z.object({
        id: z.uuid(),
        label: z.string(),
        sortOrder: z.number().int(),
        isCorrect: z.boolean(),
      }),
    ),
    createdAt: z.iso.datetime(),
  })
  .strict();

/**
 * What a learner is allowed to see of a poll they are being asked to answer.
 *
 * Deliberately NOT pollDtoSchema. That carries `options[].isCorrect`, so
 * serving it to a respondent would hand the answer key to anyone who could
 * vote -- for a quizMode poll that is the whole point of the exercise. It also
 * drops `resultVisibility`, `status` and `liveSessionId`, none of which a
 * respondent needs in order to choose an option.
 *
 * The read permission is `enrollment.read`, matching the respond route: an
 * enrolled learner may read the single poll they can already write to, but
 * still cannot enumerate polls (that stays on `membership.read`).
 */
export const pollRespondentOptionDtoSchema = z
  .object({
    id: z.uuid(),
    label: z.string(),
    sortOrder: z.number().int(),
  })
  .strict();

export const pollRespondentViewDtoSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    allowMultipleAnswers: z.boolean(),
    anonymousVote: z.boolean(),
    closesAt: z.iso.datetime().nullable(),
    options: z.array(pollRespondentOptionDtoSchema),
  })
  .strict();

export const pollRespondentViewResponseSchema = z.object({
  data: pollRespondentViewDtoSchema,
});
export const pollResponseSchema = z.object({ data: pollDtoSchema });
export const pollListResponseSchema = z.object({
  data: z.object({ items: z.array(pollDtoSchema) }),
});

export const pollResultsResponseSchema = z.object({
  data: z.object({
    pollId: z.uuid(),
    totalResponses: z.number().int(),
    options: z.array(
      z.object({
        optionId: z.uuid(),
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
    pollId: z.uuid(),
    pollOptionId: z.uuid(),
    membershipId: z.uuid(),
  }),
});
