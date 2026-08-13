import { z } from "zod";

const rejectForbiddenFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    filter: z.never().optional(),
    sort: z.never().optional(),
    offset: z.never().optional(),
  })
  .loose();

export const atRiskAlertStatusSchema = z.enum(["open", "acknowledged"]);

export const listAtRiskAlertsQuerySchema = rejectForbiddenFields
  .extend({
    status: atRiskAlertStatusSchema.optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const acknowledgeAtRiskAlertParamsSchema = z
  .object({
    alertId: z.uuid(),
  })
  .strict();

export const atRiskRuleDtoSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    ruleType: z.enum(["inactivity_days", "grade_below", "low_activity_vs_cohort"]),
    config: z.record(z.string(), z.unknown()),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const atRiskAlertDtoSchema = z
  .object({
    id: z.uuid(),
    ruleId: z.uuid(),
    ruleKey: z.string(),
    ruleName: z.string(),
    membershipId: z.uuid(),
    displayName: z.string(),
    status: atRiskAlertStatusSchema,
    context: z.record(z.string(), z.unknown()).nullable(),
    triggeredAt: z.string(),
    acknowledgedAt: z.string().nullable(),
  })
  .strict();

export const listAtRiskAlertsResponseSchema = z.object({
  data: z.object({
    alerts: z.array(atRiskAlertDtoSchema),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const listAtRiskRulesResponseSchema = z.object({
  data: z.object({
    rules: z.array(atRiskRuleDtoSchema),
  }),
});

export const updateAtRiskRuleBodySchema = rejectForbiddenFields
  .extend({
    name: z.string().min(1).max(120).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .strict();

export const updateAtRiskRuleParamsSchema = z
  .object({
    ruleId: z.uuid(),
  })
  .strict();

export const atRiskRuleResponseSchema = z.object({
  data: atRiskRuleDtoSchema,
});

export const acknowledgeAtRiskAlertResponseSchema = z.object({
  data: atRiskAlertDtoSchema,
});

export const evaluateAtRiskAlertsResponseSchema = z.object({
  data: z.object({
    evaluatedRules: z.number().int().nonnegative(),
    alertsCreated: z.number().int().nonnegative(),
    alertsUpdated: z.number().int().nonnegative(),
  }),
});

export type ListAtRiskAlertsQuery = z.output<typeof listAtRiskAlertsQuerySchema>;
export type UpdateAtRiskRuleBody = z.output<typeof updateAtRiskRuleBodySchema>;
