import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { evaluateAtRiskAlertsResponseSchema } from "@atlas/domain/at-risk/at-risk.dto";
import { evaluateAtRiskAlerts } from "@atlas/domain/at-risk/at-risk.service";
import { evaluateAtRiskAlertsMetadata } from "@atlas/domain/at-risk/at-risk.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof evaluateAtRiskAlertsResponseSchema>
>({
  metadata: evaluateAtRiskAlertsMetadata,
  output: evaluateAtRiskAlertsResponseSchema,
  handler: async ({ tx, ctx }) => evaluateAtRiskAlerts(tx, ctx),
});
