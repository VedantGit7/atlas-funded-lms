import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  listAtRiskAlertsQuerySchema,
  listAtRiskAlertsResponseSchema,
} from "@atlas/domain/at-risk/at-risk.dto";
import { listAtRiskAlerts } from "@atlas/domain/at-risk/at-risk.service";
import { listAtRiskAlertsMetadata } from "@atlas/domain/at-risk/at-risk.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof listAtRiskAlertsQuerySchema>,
  z.output<typeof listAtRiskAlertsResponseSchema>
>({
  metadata: listAtRiskAlertsMetadata,
  input: listAtRiskAlertsQuerySchema,
  output: listAtRiskAlertsResponseSchema,
  handler: async ({ tx, ctx, input }) => listAtRiskAlerts(tx, ctx, input),
});
