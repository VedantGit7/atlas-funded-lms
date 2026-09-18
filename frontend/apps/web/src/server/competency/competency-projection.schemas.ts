// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";

const rejectTenantId = z.object({ tenant_id: z.never().optional() }).loose();

export const assessmentSubmittedPayloadSchema = z
  .object({
    attemptId: z.uuid(),
    assessmentId: z.uuid(),
    membershipId: z.uuid(),
    status: z.string(),
    scorePercent: z.number().nullable(),
    requiresManualGrading: z.boolean(),
  })
  .strict()
  .and(rejectTenantId);

export const assessmentGradedPayloadSchema = z
  .object({
    assessmentId: z.uuid(),
    attemptId: z.uuid(),
    gradingTaskId: z.uuid(),
    itemId: z.uuid().nullable(),
    learnerMembershipId: z.uuid(),
    graderMembershipId: z.uuid(),
    score: z.number(),
    possiblePoints: z.number(),
    attemptState: z.string(),
    requestId: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const practiceSessionCompletedPayloadSchema = z
  .object({
    practiceSessionId: z.uuid(),
    membershipId: z.uuid(),
    collectionId: z.uuid().nullable().optional(),
    sessionType: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const competencyHistoryQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    scoringProfileId: z.uuid().optional(),
  })
  .strict()
  .and(rejectTenantId);

export const competencySignalsQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    membershipId: z.uuid().optional(),
    dimensionId: z.uuid().optional(),
    signalSourceKey: z.string().min(1).max(128).optional(),
  })
  .strict()
  .and(rejectTenantId);

export const competencyScoreDtoSchema = z.object({
  dimensionId: z.uuid(),
  dimensionKey: z.string(),
  dimensionName: z.string(),
  scoringProfileId: z.uuid(),
  scoringProfileKey: z.string(),
  score: z.number(),
  bandKey: z.string().nullable(),
  bandLabel: z.string().nullable(),
  calculatedAt: z.string(),
  configVersionId: z.uuid(),
});

export const compositeReadinessDtoSchema = z.object({
  compositeKey: z.string(),
  score: z.number(),
  bandKey: z.string(),
  calculatedAt: z.string(),
  scoringProfileId: z.uuid(),
});

export const myCompetencyResponseSchema = z.object({
  data: z.object({
    scores: z.array(competencyScoreDtoSchema),
    composites: z.array(compositeReadinessDtoSchema),
  }),
});

export const competencySnapshotDtoSchema = z.object({
  id: z.uuid(),
  scoringProfileId: z.uuid(),
  scoringProfileKey: z.string(),
  occurredAt: z.string(),
  scores: z.array(
    z.object({
      dimensionId: z.uuid(),
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
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const memberCompetencyResponseSchema = myCompetencyResponseSchema;

export const competencySignalDtoSchema = z.object({
  id: z.uuid(),
  membershipId: z.uuid(),
  dimensionId: z.uuid(),
  dimensionKey: z.string(),
  signalSourceKey: z.string(),
  sourceEventId: z.uuid().nullable(),
  rawScore: z.number(),
  weight: z.number(),
  occurredAt: z.string(),
});

export const competencySignalsListResponseSchema = z.object({
  data: z.object({
    items: z.array(competencySignalDtoSchema),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export type AssessmentSubmittedPayload = z.infer<typeof assessmentSubmittedPayloadSchema>;
export type AssessmentGradedPayload = z.infer<typeof assessmentGradedPayloadSchema>;
export type PracticeSessionCompletedPayload = z.infer<typeof practiceSessionCompletedPayloadSchema>;
export type CompetencyHistoryQuery = z.infer<typeof competencyHistoryQuerySchema>;
export type CompetencySignalsQuery = z.infer<typeof competencySignalsQuerySchema>;
