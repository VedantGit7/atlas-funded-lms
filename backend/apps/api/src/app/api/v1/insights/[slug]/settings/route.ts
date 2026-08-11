import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  insightSettingsMutationBodySchema,
  insightSettingsResponseSchema,
} from "../../../../../../server/insights/insights.schemas";
import {
  getInsightSettings,
  mutateInsightSettings,
} from "../../../../../../server/insights/insights.service";
import {
  insightDashboardMetadata,
  insightSettingsMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

const paramsSchema = z.object({ slug: z.string().min(1) });

export const GET = createTenantRoute<
  undefined,
  Zod.output<typeof insightSettingsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightDashboardMetadata,
  params: paramsSchema,
  output: insightSettingsResponseSchema,
  handler: async ({ tx, ctx, params }) => ({
    data: await getInsightSettings(tx, ctx, params.slug),
  }),
});

export const PATCH = createTenantRoute<
  Zod.output<typeof insightSettingsMutationBodySchema>,
  Zod.output<typeof insightSettingsResponseSchema>,
  typeof paramsSchema
>({
  metadata: insightSettingsMutateMetadata,
  params: paramsSchema,
  body: insightSettingsMutationBodySchema,
  output: insightSettingsResponseSchema,
  handler: async ({ tx, ctx, params, input }) => ({
    data: await mutateInsightSettings(tx, ctx, params.slug, input),
  }),
});
