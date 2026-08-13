import { z } from "zod";

export const gradingTaskStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "GRADED", "CANCELLED"]);

export const gradingListQuerySchema = z
  .object({
    status: gradingTaskStatusSchema.optional(),
    assessmentId: z.uuid().optional(),
    learnerMembershipId: z.uuid().optional(),
    assignedTo: z.enum(["me", "all"]).default("me"),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.uuid().optional(),
  })
  .strict();

export const gradingTaskParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

const idempotencyKeySchema = z.string().trim().min(8).max(128);

export const gradeTaskBodySchema = z
  .object({
    score: z.number().min(0),
    feedback: z.string().trim().min(1).max(10000),
    rubricJson: z.record(z.string(), z.unknown()).optional(),
    graderNotesJson: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey: idempotencyKeySchema.optional(),
  })
  .strict();

export const gradingQueueItemSchema = z.object({
  id: z.uuid(),
  status: gradingTaskStatusSchema,
  assessmentTitle: z.string(),
  learnerDisplayName: z.string(),
  itemType: z.string(),
  possiblePoints: z.number(),
  submittedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const gradingListResponseSchema = z.object({
  data: z.array(gradingQueueItemSchema),
  page: z.object({
    nextCursor: z.uuid().nullable(),
    hasMore: z.boolean(),
  }),
});

export const gradingAnswerItemSchema = z.object({
  assessmentItemId: z.uuid(),
  itemType: z.string(),
  prompt: z.string(),
  content: z.unknown().nullable(),
  learnerAnswer: z.unknown().nullable(),
  possiblePoints: z.number(),
  pointsAwarded: z.number().nullable(),
});

export const gradingProctoringEventSchema = z.object({
  id: z.uuid(),
  occurredAt: z.string(),
  eventType: z.string(),
  severity: z.string(),
  summary: z.string().nullable(),
});

export const gradingProctoringReportSchema = z
  .object({
    id: z.uuid(),
    summary: z.string(),
    riskScore: z.number().nullable(),
    riskBand: z.enum(["clean", "mild", "elevated", "egregious"]).nullable(),
    generatedAt: z.string(),
  })
  .nullable();

export const gradingTaskDetailSchema = z.object({
  id: z.uuid(),
  status: gradingTaskStatusSchema,
  assessment: z.object({
    id: z.uuid(),
    title: z.string(),
    assessmentType: z.string(),
  }),
  attempt: z.object({
    id: z.uuid(),
    status: z.string(),
    submittedAt: z.string().nullable(),
    scorePercent: z.number().nullable(),
  }),
  learner: z.object({
    membershipId: z.uuid(),
    displayName: z.string(),
  }),
  answers: z.array(gradingAnswerItemSchema),
  possiblePoints: z.number(),
  existingGrade: z
    .object({
      score: z.number(),
      feedback: z.string(),
      rubricJson: z.record(z.string(), z.unknown()).optional(),
      graderNotesJson: z.record(z.string(), z.unknown()).optional(),
      gradedAt: z.string(),
    })
    .nullable(),
  proctoringTimeline: z.array(gradingProctoringEventSchema),
  proctoringReport: gradingProctoringReportSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const gradingTaskDetailResponseSchema = z.object({
  data: gradingTaskDetailSchema,
});

export const gradeTaskResultSchema = z.object({
  data: z.object({
    gradingTaskId: z.uuid(),
    status: gradingTaskStatusSchema,
    score: z.number(),
    possiblePoints: z.number(),
    feedback: z.string(),
    attemptId: z.uuid(),
    attemptStatus: z.string(),
    scorePercent: z.number().nullable(),
    gradedAt: z.string(),
  }),
});

export type GradingListQuery = z.output<typeof gradingListQuerySchema>;
export type GradeTaskBody = z.output<typeof gradeTaskBodySchema>;
