import { z } from "zod";
import { workflowGraphSchema, workflowNodeSchema } from "./marketing-workflow.graph";

export const marketingWorkflowDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]),
  allowResubscribe: z.boolean(),
  useCaseKey: z.string().nullable(),
  graph: workflowGraphSchema,
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketingWorkflowListItemSchema = marketingWorkflowDtoSchema.extend({
  stepCount: z.number().int().nonnegative(),
  triggerLabel: z.string(),
  summaryLabel: z.string(),
  activeRunCount: z.number().int().nonnegative(),
  useCaseTitle: z.string().nullable(),
});

export const marketingWorkflowsListSummarySchema = z.object({
  publishedCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  unpublishedCount: z.number().int().nonnegative(),
  totalActiveRuns: z.number().int().nonnegative(),
});

export const marketingWorkflowsListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "PUBLISHED", "UNPUBLISHED"]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const marketingWorkflowsListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingWorkflowListItemSchema),
    summary: marketingWorkflowsListSummarySchema,
  }),
});

export const marketingWorkflowResponseSchema = z.object({ data: marketingWorkflowDtoSchema });

export const createMarketingWorkflowBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    allowResubscribe: z.boolean().optional().default(false),
  })
  .strict();

export const updateMarketingWorkflowBasicsBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    allowResubscribe: z.boolean(),
  })
  .strict();

export const applyUseCaseBodySchema = z
  .object({ useCaseKey: z.string().trim().min(1).max(64) })
  .strict();

export const updateMarketingWorkflowGraphBodySchema = z
  .object({ graph: workflowGraphSchema })
  .strict();

export const updateWorkflowNodeBodySchema = z
  .object({ node: workflowNodeSchema })
  .strict();

export const deleteMarketingWorkflowBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteMarketingWorkflowResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const marketingUseCaseDtoSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
});

export const marketingUseCasesResponseSchema = z.object({
  data: z.object({ items: z.array(marketingUseCaseDtoSchema) }),
});

export const testFireWorkflowBodySchema = z
  .object({
    membershipId: z.string().uuid().optional(),
    eventType: z.string().trim().min(1).max(128).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const testFireWorkflowResponseSchema = z.object({
  data: z.object({ started: z.number().int().nonnegative() }),
});

export const marketingWorkflowRunDtoSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  membershipId: z.string().uuid().nullable(),
  learnerName: z.string().nullable(),
  learnerEmail: z.string().nullable(),
  status: z.string(),
  triggerEventType: z.string(),
  currentNodeId: z.string().nullable(),
  currentNodeTitle: z.string().nullable(),
  waitUntil: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const marketingWorkflowRunsResponseSchema = z.object({
  data: z.object({ items: z.array(marketingWorkflowRunDtoSchema) }),
});
