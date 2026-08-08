import { z } from "zod";

const rejectTenantId = z.object({ tenant_id: z.never().optional() }).passthrough();

export const lessonCompletedPayloadSchema = z
  .object({
    lessonId: z.string().uuid(),
    courseId: z.string().uuid(),
    moduleId: z.string().uuid(),
    membershipId: z.string().uuid(),
    enrollmentId: z.string().uuid(),
    completedAt: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const pathStepCompletedPayloadSchema = z
  .object({
    pathId: z.string().uuid(),
    stepId: z.string().uuid(),
    membershipId: z.string().uuid(),
    completedAt: z.string(),
  })
  .strict()
  .and(rejectTenantId);

export const gamificationAssessmentSubmittedPayloadSchema = z
  .object({
    attemptId: z.string().uuid(),
    assessmentId: z.string().uuid(),
    membershipId: z.string().uuid(),
    status: z.string(),
    scorePercent: z.number().nullable(),
    requiresManualGrading: z.boolean(),
  })
  .strict()
  .and(rejectTenantId);

export const gamificationAssessmentGradedPayloadSchema = z
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
  })
  .strict()
  .and(rejectTenantId);

export const gamificationPracticeSessionCompletedPayloadSchema = z
  .object({
    practiceSessionId: z.string().uuid(),
    membershipId: z.string().uuid(),
    collectionId: z.string().uuid().nullable().optional(),
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
