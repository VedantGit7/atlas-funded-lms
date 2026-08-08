import { z } from "zod";

export const WORKFLOW_TRIGGER_TYPES = [
  "learner_signup",
  "form_submitted",
  "payment_success",
  "test_evaluation",
  "product_expiry_soon",
  "enrollment_created",
  "manual_test",
] as const;

export const WORKFLOW_ACTION_TYPES = [
  "send_message",
  "send_free_resource",
  "send_coupon",
  "send_paid_enrollment_invite",
  "register_marketing_event",
  "send_webinar_invite",
] as const;

export const workflowEmailConfigSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  bodyHtml: z.string().trim().min(1).max(50000),
  templateKey: z.string().trim().max(64).optional().nullable(),
});

export const workflowTriggerConfigSchema = z
  .object({
    triggerType: z.enum(WORKFLOW_TRIGGER_TYPES),
    formId: z.string().trim().max(128).optional().nullable(),
    formLabel: z.string().trim().max(200).optional().nullable(),
    productId: z.string().trim().max(128).optional().nullable(),
    productLabel: z.string().trim().max(200).optional().nullable(),
    courseId: z.string().trim().max(128).optional().nullable(),
    courseLabel: z.string().trim().max(200).optional().nullable(),
    testId: z.string().trim().max(128).optional().nullable(),
    testLabel: z.string().trim().max(200).optional().nullable(),
    accessType: z.string().trim().max(64).optional().nullable(),
    daysBeforeExpiry: z.number().int().min(1).max(90).optional().nullable(),
  })
  .strict();

export const workflowDelayConfigSchema = z
  .object({
    days: z.number().int().min(0).max(365).default(0),
    hours: z.number().int().min(0).max(23).default(0),
    minutes: z.number().int().min(0).max(59).default(0),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.days + value.hours + value.minutes <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delay must be greater than zero.",
      });
    }
  });

export const workflowConditionConfigSchema = z
  .object({
    conditionType: z.literal("test_percentage"),
    operator: z.enum(["gte", "lte", "eq"]),
    value: z.number().min(0).max(100),
  })
  .strict();

export const workflowActionConfigSchema = z
  .object({
    actionType: z.enum(WORKFLOW_ACTION_TYPES),
    channel: z.enum(["email"]).default("email"),
    resourceLabel: z.string().trim().max(200).optional().nullable(),
    attachmentUrl: z.string().trim().max(2000).optional().nullable(),
    couponCode: z.string().trim().max(64).optional().nullable(),
    productLabel: z.string().trim().max(200).optional().nullable(),
    eventId: z.string().uuid().optional().nullable(),
    eventLabel: z.string().trim().max(200).optional().nullable(),
    webinarLabel: z.string().trim().max(200).optional().nullable(),
    reminderHours: z.number().int().min(0).max(720).optional().nullable(),
    email: workflowEmailConfigSchema.optional().nullable(),
  })
  .strict();

export const workflowNodeSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(["trigger", "delay", "condition", "action"]),
    title: z.string().trim().min(1).max(200),
    config: z.record(z.string(), z.unknown()).default({}),
    next: z.string().max(64).nullable().optional(),
    onTrue: z.string().max(64).nullable().optional(),
    onFalse: z.string().max(64).nullable().optional(),
  })
  .strict();

export const workflowGraphSchema = z
  .object({
    entryNodeId: z.string().min(1).max(64),
    nodes: z.record(z.string(), workflowNodeSchema),
  })
  .strict();

export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const TRIGGER_EVENT_MAP: Record<(typeof WORKFLOW_TRIGGER_TYPES)[number], string[]> = {
  learner_signup: ["membership.created"],
  enrollment_created: ["learning.enrollment.created"],
  test_evaluation: ["assessment.graded"],
  form_submitted: ["marketing.form_submitted"],
  payment_success: ["marketing.payment_success"],
  product_expiry_soon: ["marketing.product_expiry_soon"],
  manual_test: ["marketing.workflow_manual_test"],
};

export function emptyGraph(): WorkflowGraph {
  const triggerId = "trigger_1";
  return {
    entryNodeId: triggerId,
    nodes: {
      [triggerId]: {
        id: triggerId,
        type: "trigger",
        title: "Subscribe trigger",
        config: { triggerType: "manual_test" },
        next: null,
      },
    },
  };
}
