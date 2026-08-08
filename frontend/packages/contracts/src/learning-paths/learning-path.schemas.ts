import { z } from "zod";
import { mutationBodySchema, pageInfoSchema } from "../membership/schemas/shared";

export const publishStatusLearnerSchema = z.literal("PUBLISHED");
export const publishStatusStudioSchema = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);
export const pathTypeSchema = z.enum(["roadmap", "program"]);
export const pathStepTypeSchema = z.enum(["course", "assessment", "path"]);
export const pathGateTypeSchema = z.enum([
  "open",
  "previous_step_completed",
  "assessment_passed",
  "competency_band",
  "manual",
  "time_based",
]);

export const pathGateInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    gateType: pathGateTypeSchema,
    config: z.record(z.unknown()).default({}),
  })
  .strict();

export const pathStepInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    stepType: pathStepTypeSchema,
    refId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200),
    position: z.number().int().min(1).max(500),
    gates: z.array(pathGateInputSchema).max(20).default([]),
  })
  .strict();

export const learningPathListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    type: pathTypeSchema.optional(),
    status: publishStatusStudioSchema.optional(),
    view: z.literal("studio").optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status != null && value.view !== "studio") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status filter requires view=studio",
        path: ["status"],
      });
    }
  });

export type LearningPathListQuery = z.output<typeof learningPathListQuerySchema>;

export const learningPathIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const pathDetailQuerySchema = z
  .object({
    view: z.literal("studio").optional(),
  })
  .strict();

export type PathDetailQuery = z.output<typeof pathDetailQuerySchema>;

export const createLearningPathBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
    .optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  pathType: pathTypeSchema.default("program"),
  metadata: z.record(z.unknown()).optional(),
  memberId: z.never().optional(),
  userId: z.never().optional(),
  membershipId: z.never().optional(),
});

export type CreateLearningPathBody = z.output<typeof createLearningPathBodySchema>;

export const updateLearningPathBodySchema = mutationBodySchema({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
    .optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  pathType: pathTypeSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  steps: z.array(pathStepInputSchema).max(200).optional(),
  status: z.never().optional(),
  memberId: z.never().optional(),
  userId: z.never().optional(),
  membershipId: z.never().optional(),
  createdBy: z.never().optional(),
  created_by_membership_id: z.never().optional(),
});

export type UpdateLearningPathBody = z.output<typeof updateLearningPathBodySchema>;

export const publishLearningPathBodySchema = mutationBodySchema({
  reason: z.string().trim().max(1000).optional(),
});

export type PublishLearningPathBody = z.output<typeof publishLearningPathBodySchema>;

export const enrollLearningPathBodySchema = mutationBodySchema({
  memberId: z.never().optional(),
  userId: z.never().optional(),
  membershipId: z.never().optional(),
});

export type EnrollLearningPathBody = z.output<typeof enrollLearningPathBodySchema>;

export const pathGateResponseSchema = z.object({
  id: z.string().uuid(),
  gateType: pathGateTypeSchema,
  config: z.record(z.unknown()),
});

export const pathStepResponseSchema = z.object({
  id: z.string().uuid(),
  stepType: pathStepTypeSchema,
  refId: z.string().uuid().nullable(),
  title: z.string(),
  position: z.number().int(),
  gates: z.array(pathGateResponseSchema),
});

export const learningPathListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  pathType: pathTypeSchema,
  status: z.union([publishStatusLearnerSchema, publishStatusStudioSchema]),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const learningPathListResponseSchema = z.object({
  data: z.object({
    items: z.array(learningPathListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const learningPathDetailSchema = learningPathListItemSchema.extend({
  steps: z.array(pathStepResponseSchema),
  enrollmentStatus: z.enum(["enrolled", "not_enrolled"]).optional(),
});

export const learningPathDetailResponseSchema = z.object({
  data: learningPathDetailSchema,
});

export const createLearningPathResponseSchema = z.object({
  data: learningPathListItemSchema,
});

export const publishLearningPathResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.literal("REVIEW"),
    submittedAt: z.string().datetime(),
    workflowTransitionId: z.string().uuid(),
  }),
});

export const enrollLearningPathResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    pathId: z.string().uuid(),
    status: z.literal("active"),
    enrolledAt: z.string().datetime(),
    created: z.boolean(),
  }),
});

export const pathProgressResponseSchema = z.object({
  data: z.object({
    pathId: z.string().uuid(),
    enrolled: z.boolean(),
    enrollmentId: z.string().uuid().nullable(),
    enrolledAt: z.string().datetime().nullable(),
    completedStepCount: z.number().int().nonnegative(),
    totalStepCount: z.number().int().nonnegative(),
    currentStepId: z.string().uuid().nullable(),
    nextAction: z.object({
      type: z.enum(["enroll", "continue", "complete", "wait_for_gate"]),
      stepId: z.string().uuid().nullable(),
      label: z.string(),
    }),
    steps: z.array(
      z.object({
        stepId: z.string().uuid(),
        position: z.number().int(),
        title: z.string(),
        stepType: pathStepTypeSchema,
        refId: z.string().uuid().nullable(),
        progressStatus: z.enum(["locked", "unlocked", "in_progress", "completed"]),
        locked: z.boolean(),
        gates: z.array(
          z.object({
            id: z.string().uuid(),
            gateType: pathGateTypeSchema,
            state: z.enum(["satisfied", "locked", "pending"]),
            config: z.record(z.unknown()),
          }),
        ),
        href: z.string().nullable(),
      }),
    ),
  }),
});

export const deleteLearningPathResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});
