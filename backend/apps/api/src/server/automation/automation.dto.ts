import { createHash } from "node:crypto";
import { z } from "zod";
import {
  automationRuleKeySchema,
  automationTriggerEventTypeSchema,
  parseAutomationAction,
  parseAutomationCondition,
  type REGISTERED_AUTOMATION_ACTION_TYPES,
} from "./automation.registry";

type AutomationActionType = (typeof REGISTERED_AUTOMATION_ACTION_TYPES)[number];

export const ENTITY_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const entityStatusSchema = z.enum(ENTITY_STATUSES);

export const automationRuleDtoSchema = z.object({
  id: z.string().uuid(),
  key: automationRuleKeySchema,
  triggerEventType: automationTriggerEventTypeSchema,
  conditionJson: z.unknown(),
  actionJson: z.unknown(),
  status: entityStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const automationRuleListResponseSchema = z.object({
  data: z.array(automationRuleDtoSchema),
});

export const automationRuleDetailResponseSchema = z.object({
  data: automationRuleDtoSchema,
});

export const automationRuleDeleteResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const automationRunListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    automationRuleId: z.string().uuid().optional(),
  })
  .strict();

export const automationRunDtoSchema = z.object({
  id: z.string().uuid(),
  automationRuleId: z.string().uuid(),
  sourceEventId: z.string().uuid(),
  status: z.enum(JOB_STATUSES),
  resultJson: z.unknown().nullable(),
  occurredAt: z.string().datetime(),
});

export const automationRunListResponseSchema = z.object({
  data: z.array(automationRunDtoSchema),
});

export const createAutomationRuleBodySchema = z
  .object({
    key: automationRuleKeySchema,
    triggerEventType: automationTriggerEventTypeSchema,
    conditionJson: z.unknown().optional(),
    actionJson: z.unknown(),
    status: entityStatusSchema.default("ACTIVE"),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      parseAutomationCondition(value.conditionJson);
      parseAutomationAction(value.actionJson);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid automation configuration.",
        path: ["actionJson"],
      });
    }
  });

export const updateAutomationRuleBodySchema = z
  .object({
    id: z.string().uuid(),
    key: automationRuleKeySchema.optional(),
    triggerEventType: automationTriggerEventTypeSchema.optional(),
    conditionJson: z.unknown().optional(),
    actionJson: z.unknown().optional(),
    status: entityStatusSchema.optional(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.conditionJson !== undefined) {
      try {
        parseAutomationCondition(value.conditionJson);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error instanceof Error ? error.message : "Invalid condition_json.",
          path: ["conditionJson"],
        });
      }
    }
    if (value.actionJson !== undefined) {
      try {
        parseAutomationAction(value.actionJson);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error instanceof Error ? error.message : "Invalid action_json.",
          path: ["actionJson"],
        });
      }
    }
  });

export const deleteAutomationRuleBodySchema = z
  .object({
    id: z.string().uuid(),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export function buildAutomationRunIdempotencyKey(args: {
  automationRuleId: string;
  sourceEventId: string;
}): string {
  return `${args.automationRuleId}:${args.sourceEventId}`;
}

export function buildAutomationActionIdempotencyKey(args: {
  automationRuleId: string;
  sourceEventId: string;
  actionType: AutomationActionType;
}): string {
  return createHash("sha256")
    .update(`${args.automationRuleId}:${args.sourceEventId}:${args.actionType}`)
    .digest("hex");
}

export type CreateAutomationRuleBody = z.infer<typeof createAutomationRuleBodySchema>;
export type UpdateAutomationRuleBody = z.infer<typeof updateAutomationRuleBodySchema>;
export type DeleteAutomationRuleBody = z.infer<typeof deleteAutomationRuleBodySchema>;
