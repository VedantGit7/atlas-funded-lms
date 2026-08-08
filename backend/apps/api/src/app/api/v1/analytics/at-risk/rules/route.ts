import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listAtRiskRulesResponseSchema } from "@atlas/domain/at-risk/at-risk.dto";
import { listAtRiskRules } from "@atlas/domain/at-risk/at-risk.service";
import { listAtRiskRulesMetadata } from "@atlas/domain/at-risk/at-risk.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof listAtRiskRulesResponseSchema>
>({
  metadata: listAtRiskRulesMetadata,
  output: listAtRiskRulesResponseSchema,
  handler: async ({ tx, ctx }) => listAtRiskRules(tx, ctx),
});
