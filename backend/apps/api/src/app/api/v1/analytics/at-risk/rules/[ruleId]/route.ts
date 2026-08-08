import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  atRiskRuleResponseSchema,
  updateAtRiskRuleBodySchema,
  updateAtRiskRuleParamsSchema,
} from "@atlas/domain/at-risk/at-risk.dto";
import { updateAtRiskRule } from "@atlas/domain/at-risk/at-risk.service";
import { updateAtRiskRuleMetadata } from "@atlas/domain/at-risk/at-risk.route-metadata";

export const PATCH = createTenantRoute<
  z.output<typeof updateAtRiskRuleBodySchema>,
  z.output<typeof atRiskRuleResponseSchema>,
  typeof updateAtRiskRuleParamsSchema
>({
  metadata: updateAtRiskRuleMetadata,
  params: updateAtRiskRuleParamsSchema,
  input: updateAtRiskRuleBodySchema,
  output: atRiskRuleResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateAtRiskRule(tx, ctx, params["ruleId"], input),
});
