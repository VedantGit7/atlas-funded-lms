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
  questionsPerAttempt: z.number().int().nullable(),
  negativeMarkPercent: z.number(),
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
  /**
   * The course lesson this quiz belongs to: it's edited there and goes live
   * with the lesson (S3.4). Null for a quiz of its own.
   */
  courseLesson: z
    .object({
      courseId: z.uuid(),
      courseTitle: z.string(),
      lessonId: z.uuid(),
      lessonTitle: z.string(),
    })
    .nullable()
    .optional(),
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

const choiceLabelSchema = z.object({ id: z.string(), label: z.string() });

/**
 * A matching or ordering question's items, with opaque ids, for answering
 * (QA review 1 N1; see attempts/attempt-choices.ts).
 */
export const attemptChoicesSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("matching"),
    left: z.array(choiceLabelSchema),
    right: z.array(choiceLabelSchema),
  }),
  z.object({ kind: z.literal("ordering"), items: z.array(choiceLabelSchema) }),
]);

/**
 * A question after submission, in words (QA review 2 H23; see
 * attempts/attempt-review.ts). Sent only when the quiz allows review.
 */
export const attemptItemReviewSchema = z.object({
  isCorrect: z.boolean().nullable(),
  pointsAwarded: z.number().nullable(),
  points: z.number(),
  markedByInstructor: z.boolean(),
  yourAnswer: z.array(z.string()),
  correctAnswer: z.array(z.string()),
  correctAnswerLabel: z.string(),
  explanation: z.string().nullable(),
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
  choices: attemptChoicesSchema.optional(),
  /** Limits the learner sees while answering, such as a long answer's word limit (S3.4b). */
  answerLimits: z.object({ maxWords: z.number().int().optional() }).optional(),
  review: attemptItemReviewSchema.optional(),
});

/** The course lesson a quiz belongs to, for the learner's way back. */
export const attemptLessonLinkSchema = z.object({
  courseId: z.uuid(),
  lessonId: z.uuid(),
  title: z.string(),
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
    title: z.string().optional(),
    lesson: attemptLessonLinkSchema.nullable().optional(),
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
