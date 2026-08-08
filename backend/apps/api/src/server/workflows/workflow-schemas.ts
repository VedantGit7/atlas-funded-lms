import { z } from "zod";

export const workflowTargetTypeSchema = z.enum(["course", "assessment", "learning_path"]);

export const workflowListQuerySchema = z.object({
  status: z.enum(["pending", "acted", "all"]).default("pending"),
  targetType: workflowTargetTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).optional(),
});

export type WorkflowListQuery = z.output<typeof workflowListQuerySchema>;

export const workflowTransitionParamsSchema = z.object({
  id: z.string().uuid(),
});

export const workflowTransitionBodySchema = z
  .object({
    action: z.enum(["approve", "reject", "return"]),
    comment: z.string().trim().min(3).max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.action === "reject" || value.action === "return") && !value.comment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["comment"],
        message: "Comment is required for reject/return",
      });
    }
  });

export type WorkflowTransitionBody = z.output<typeof workflowTransitionBodySchema>;

const publishLifecycleStatusSchema = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

const workflowTargetBaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: publishLifecycleStatusSchema,
  createdByMembershipId: z.string().uuid().optional(),
});

export const workflowTargetSchema = z.discriminatedUnion("type", [
  workflowTargetBaseSchema.extend({ type: z.literal("course") }),
  workflowTargetBaseSchema.extend({ type: z.literal("assessment") }),
  workflowTargetBaseSchema.extend({ type: z.literal("learning_path") }),
]);

export const workflowQueueItemSchema = z.object({
  id: z.string().uuid(),
  workflowDefinitionId: z.string().uuid(),
  target: workflowTargetSchema,
  fromState: z.string(),
  toState: z.string(),
  submittedByMembershipId: z.string().uuid(),
  submittedAt: z.string().datetime(),
  comment: z.string().nullable(),
  availableActions: z.array(z.enum(["approve", "reject", "return"])),
});

export const workflowListResponseSchema = z.object({
  data: z.array(workflowQueueItemSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export const workflowTransitionResultSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    workflowDefinitionId: z.string().uuid(),
    targetType: workflowTargetTypeSchema,
    targetId: z.string().uuid(),
    action: z.enum(["approve", "reject", "return"]),
    fromState: z.string(),
    toState: z.string(),
    targetStatus: publishLifecycleStatusSchema,
    occurredAt: z.string().datetime(),
    comment: z.string().nullable(),
  }),
});

export const workflowHistoryItemSchema = z.object({
  id: z.string().uuid(),
  fromState: z.string(),
  toState: z.string(),
  actorMembershipId: z.string().uuid(),
  reason: z.string().nullable(),
  occurredAt: z.string().datetime(),
  action: z.enum(["submit", "approve", "reject", "return"]).nullable(),
});

export const workflowHistoryResponseSchema = z.object({
  data: z.object({
    items: z.array(workflowHistoryItemSchema),
  }),
});

export const workflowDefinitionViewSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  definitionJson: z.record(z.string(), z.unknown()),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]),
  updatedAt: z.string().datetime(),
});

export const workflowDefinitionListResponseSchema = z.object({
  data: z.array(workflowDefinitionViewSchema),
});

export const updateWorkflowDefinitionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    definitionJson: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
  })
  .strict();

export const createWorkflowDefinitionBodySchema = z
  .object({
    key: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(200),
    definitionJson: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const workflowDefinitionResponseSchema = z.object({
  data: workflowDefinitionViewSchema,
});

export const workflowHistoryQuerySchema = z
  .object({
    targetType: workflowTargetTypeSchema,
    targetId: z.string().uuid(),
  })
  .strict();

export type WorkflowHistoryQuery = z.output<typeof workflowHistoryQuerySchema>;
