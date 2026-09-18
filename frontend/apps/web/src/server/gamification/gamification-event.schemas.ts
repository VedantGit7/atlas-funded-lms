// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";

const rejectTenantId = z.object({ tenant_id: z.never().optional() }).loose();

export const lessonCompletedPayloadSchema = z
  .object({
    lessonId: z.uuid(),
    courseId: z.uuid(),
    moduleId: z.uuid(),
    membershipId: z.uuid(),
    enrollmentId: z.uuid(),
    completedAt: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const pathStepCompletedPayloadSchema = z
  .object({
    pathId: z.uuid(),
    stepId: z.uuid(),
    membershipId: z.uuid(),
    completedAt: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const gamificationAssessmentSubmittedPayloadSchema = z
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

export const gamificationAssessmentGradedPayloadSchema = z
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

export const gamificationPracticeSessionCompletedPayloadSchema = z
  .object({
    practiceSessionId: z.uuid(),
    membershipId: z.uuid(),
    collectionId: z.uuid().nullable().optional(),
    sessionType: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const GAMIFICATION_CONSUMED_EVENT_TYPES = [
  "lesson.completed",
  "path.step_completed",
  "assessment.submitted",
  "assessment.graded",
  "practice.session_completed",
] as const;

export type GamificationConsumedEventType = (typeof GAMIFICATION_CONSUMED_EVENT_TYPES)[number];
