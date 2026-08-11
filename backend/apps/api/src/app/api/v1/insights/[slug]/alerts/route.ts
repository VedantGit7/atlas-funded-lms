import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightAlertsMutationBodySchema,
  insightAlertsResponseSchema,
  insightDashboardQuerySchema,
} from "../../../../../../server/insights/insights.schemas";
import {
  getInsightAlerts,
  mutateInsightAlerts,
} from "../../../../../../server/insights/insights.service";
import {
  insightAlertsMutateMetadata,
  insightDashboardMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  Zod.output<typeof insightDashboardQuerySchema>,
  Zod.output<typeof insightAlertsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  input: insightDashboardQuerySchema,
  output: insightAlertsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await getInsightAlerts(tx, ctx, params.slug, input.range),
  }),
});

export const PATCH = createTenantRoute<
  Zod.output<typeof insightAlertsMutationBodySchema>,
  Zod.output<typeof insightAlertsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightAlertsMutateMetadata,
  params: paramsSchema,
  body: insightAlertsMutationBodySchema,
  output: insightAlertsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await mutateInsightAlerts(tx, ctx, params.slug, input.range ?? "12m", input),
  }),
});
