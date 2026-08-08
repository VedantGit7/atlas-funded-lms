import { z } from "zod";

export const assessmentSubmittedPayloadSchema = z
  .object({
    attemptId: z.string().uuid(),
    assessmentId: z.string().uuid(),
    membershipId: z.string().uuid(),
    status: z.string(),
    scorePercent: z.number().nullable(),
    requiresManualGrading: z.boolean(),
    tenant_id: z.never().optional(),
  })
  .strict();

export const assessmentGradedPayloadSchema = z
  .object({
    assessmentId: z.string().uuid(),
    attemptId: z.string().uuid(),
    gradingTaskId: z.string().uuid(),
    itemId: z.string().uuid().nullable(),
    learnerMembershipId: z.string().uuid(),
    graderMembershipId: z.string().uuid(),
    score: z.number(),
    possiblePoints: z.number(),
    attemptState: z.string(),
    requestId: z.string(),
    tenant_id: z.never().optional(),
  })
  .strict();

export const practiceSessionCompletedPayloadSchema = z
  .object({
    practiceSessionId: z.string().uuid(),
    membershipId: z.string().uuid(),
    collectionId: z.string().uuid().nullable().optional(),
    sessionType: z.string(),
    tenant_id: z.never().optional(),
  })
  .strict();

export const competencyHistoryQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    scoringProfileId: z.string().uuid().optional(),
    tenant_id: z.never().optional(),
  })
  .strict();

export const competencySignalsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    membershipId: z.string().uuid().optional(),
    dimensionId: z.string().uuid().optional(),
    signalSourceKey: z.string().min(1).max(128).optional(),
    tenant_id: z.never().optional(),
  })
  .strict();

export const competencyScoreDtoSchema = z.object({
  dimensionId: z.string().uuid(),
  dimensionKey: z.string(),
  dimensionName: z.string(),
  scoringProfileId: z.string().uuid(),
  scoringProfileKey: z.string(),
  score: z.number(),
  bandKey: z.string().nullable(),
  bandLabel: z.string().nullable(),
  calculatedAt: z.string(),
  configVersionId: z.string().uuid(),
});

export const compositeReadinessDtoSchema = z.object({
  compositeKey: z.string(),
  score: z.number(),
  bandKey: z.string(),
  calculatedAt: z.string(),
  scoringProfileId: z.string().uuid(),
});

export const myCompetencyResponseSchema = z.object({
  data: z.object({
    scores: z.array(competencyScoreDtoSchema),
    composites: z.array(compositeReadinessDtoSchema),
  }),
});

export const competencySnapshotDtoSchema = z.object({
  id: z.string().uuid(),
  scoringProfileId: z.string().uuid(),
  scoringProfileKey: z.string(),
  occurredAt: z.string(),
  scores: z.array(
    z.object({
      dimensionId: z.string().uuid(),
      dimensionKey: z.string(),
      score: z.number(),
      bandKey: z.string().nullable(),
    }),
  ),
});

export const competencyHistoryResponseSchema = z.object({
  data: z.object({
    items: z.array(competencySnapshotDtoSchema),
    pageInfo: z.object({
      nextCursor: z.string().uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const memberCompetencyResponseSchema = myCompetencyResponseSchema;

export const competencySignalDtoSchema = z.object({
  id: z.string().uuid(),
  membershipId: z.string().uuid(),
  dimensionId: z.string().uuid(),
  dimensionKey: z.string(),
  signalSourceKey: z.string(),
  sourceEventId: z.string().uuid().nullable(),
  rawScore: z.number(),
  weight: z.number(),
  occurredAt: z.string(),
});

export const competencySignalsListResponseSchema = z.object({
  data: z.object({
    items: z.array(competencySignalDtoSchema),
    pageInfo: z.object({
      nextCursor: z.string().uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export type AssessmentSubmittedPayload = z.infer<typeof assessmentSubmittedPayloadSchema>;
export type AssessmentGradedPayload = z.infer<typeof assessmentGradedPayloadSchema>;
export type PracticeSessionCompletedPayload = z.infer<typeof practiceSessionCompletedPayloadSchema>;
export type CompetencyHistoryQuery = z.infer<typeof competencyHistoryQuerySchema>;
export type CompetencySignalsQuery = z.infer<typeof competencySignalsQuerySchema>;
