import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createAutomationRuleBodySchema,
  deleteAutomationRuleBodySchema,
  automationRuleDeleteResponseSchema,
  automationRuleDetailResponseSchema,
  automationRuleListResponseSchema,
  updateAutomationRuleBodySchema,
} from "../../../../server/automation/automation.contract";
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  updateAutomationRule,
} from "../../../../server/automation/automation.service";
import {
  deleteAutomationRuleMetadata,
  listAutomationRulesMetadata,
  mutateAutomationRulesMetadata,
  updateAutomationRuleMetadata,
} from "../../../../server/automation/automation.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof automationRuleListResponseSchema>
>({
  metadata: listAutomationRulesMetadata,
  output: automationRuleListResponseSchema,
  handler: async ({ tx, ctx }) => listAutomationRules(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createAutomationRuleBodySchema>,
  z.output<typeof automationRuleDetailResponseSchema>
>({
  metadata: mutateAutomationRulesMetadata,
  body: createAutomationRuleBodySchema,
  output: automationRuleDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => createAutomationRule(tx, ctx, input),
});

export const PUT = createTenantRoute<
  z.output<typeof updateAutomationRuleBodySchema>,
  z.output<typeof automationRuleDetailResponseSchema>
>({
  metadata: updateAutomationRuleMetadata,
  body: updateAutomationRuleBodySchema,
  output: automationRuleDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateAutomationRule(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteAutomationRuleBodySchema>,
  z.output<typeof automationRuleDeleteResponseSchema>
>({
  metadata: deleteAutomationRuleMetadata,
  body: deleteAutomationRuleBodySchema,
  output: automationRuleDeleteResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteAutomationRule(tx, ctx, input),
});
