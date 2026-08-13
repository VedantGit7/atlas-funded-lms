import { z } from "zod";
import { AssessmentTypeSchema, PublishStatusSchema, ShowAnswersPolicySchema } from "./schemas";

export const assessmentConfigResponseSchema = z.object({
  attemptsAllowed: z.number().int(),
  timeLimitSeconds: z.number().int().nullable(),
  passMarkPercent: z.number(),
  shuffleItems: z.boolean(),
  shuffleOptions: z.boolean(),
  secureMode: z.boolean(),
  proctoringLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  l1ProctoringEnabled: z.boolean(),
  showAnswersPolicy: ShowAnswersPolicySchema,
});

export const assessmentItemResponseSchema = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
  position: z.number().int(),
  points: z.number(),
  required: z.boolean(),
  itemTypeKey: z.string().optional(),
  contentJson: z.record(z.string(), z.unknown()).optional(),
  options: z
    .array(
      z.object({
        id: z.uuid(),
        optionJson: z.record(z.string(), z.unknown()),
        position: z.number().int(),
      }),
    )
    .optional(),
});

export const assessmentSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assessmentType: AssessmentTypeSchema,
  status: PublishStatusSchema,
  config: assessmentConfigResponseSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const assessmentDetailSchema = assessmentSummarySchema.extend({
  items: z.array(assessmentItemResponseSchema),
});

export const assessmentListResponseSchema = z.object({
  data: z.array(assessmentSummarySchema),
  page: z.object({
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

export const assessmentDetailResponseSchema = z.object({
  data: assessmentDetailSchema,
});

export const assessmentDeleteResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const assessmentPublishResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: z.literal("REVIEW"),
    submittedAt: z.string(),
    workflowTransitionId: z.uuid(),
  }),
});

export const learnerAssessmentOverviewSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  assessmentType: AssessmentTypeSchema,
  status: PublishStatusSchema,
  config: assessmentConfigResponseSchema,
  itemCount: z.number().int(),
  attemptsUsed: z.number().int(),
  attemptsRemaining: z.number().int().nullable(),
});

export const learnerAssessmentOverviewResponseSchema = z.object({
  data: learnerAssessmentOverviewSchema,
});

export const startAttemptResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    assessmentId: z.uuid(),
    status: z.literal("STARTED"),
    startedAt: z.string(),
    dueAt: z.string().nullable(),
  }),
});

const safeOptionSchema = z.object({
  id: z.uuid(),
  optionJson: z.record(z.string(), z.unknown()),
  position: z.number().int(),
});

const runnerItemSchema = z.object({
  id: z.uuid(),
  assessmentItemId: z.uuid(),
  itemId: z.uuid(),
  itemTypeKey: z.string(),
  position: z.number().int(),
  points: z.number(),
  required: z.boolean(),
  contentJson: z.record(z.string(), z.unknown()),
  options: z.array(safeOptionSchema),
  savedAnswer: z.record(z.string(), z.unknown()).nullable(),
});

export const attemptRunnerResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    assessmentId: z.uuid(),
    status: z.enum(["STARTED", "SUBMITTED", "GRADED", "ABANDONED", "VOIDED"]),
    startedAt: z.string(),
    submittedAt: z.string().nullable(),
    dueAt: z.string().nullable(),
    serverNow: z.string(),
    secureMode: z.boolean(),
    proctoringLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    l1ProctoringEnabled: z.boolean(),
    items: z.array(runnerItemSchema),
    canReviewAnswers: z.boolean().optional(),
    scorePercent: z.number().nullable().optional(),
    passed: z.boolean().nullable().optional(),
    requiresManualGrading: z.boolean().optional(),
    passMarkPercent: z.number().optional(),
  }),
});

export const saveAnswerResponseSchema = z.object({
  data: z.object({
    assessmentItemId: z.uuid(),
    savedAt: z.string(),
  }),
});

export const submitAttemptResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: z.enum(["SUBMITTED", "GRADED"]),
    submittedAt: z.string(),
    scorePercent: z.number().nullable(),
    passed: z.boolean().nullable(),
    requiresManualGrading: z.boolean(),
    canReviewAnswers: z.boolean(),
  }),
});
