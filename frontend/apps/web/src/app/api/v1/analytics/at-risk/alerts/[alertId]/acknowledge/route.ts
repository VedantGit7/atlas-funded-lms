import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  acknowledgeAtRiskAlertParamsSchema,
  acknowledgeAtRiskAlertResponseSchema,
} from "@atlas/domain/at-risk/at-risk.dto";
import { acknowledgeAtRiskAlert } from "@atlas/domain/at-risk/at-risk.service";
import { acknowledgeAtRiskAlertMetadata } from "@atlas/domain/at-risk/at-risk.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof acknowledgeAtRiskAlertResponseSchema>,
  typeof acknowledgeAtRiskAlertParamsSchema
>({
  metadata: acknowledgeAtRiskAlertMetadata,
  params: acknowledgeAtRiskAlertParamsSchema,
  output: acknowledgeAtRiskAlertResponseSchema,
  handler: async ({ tx, ctx, params }) =>
    acknowledgeAtRiskAlert(tx, ctx, params.alertId),
});
