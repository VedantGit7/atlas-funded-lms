import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  zoomMatchingRulesBodySchema,
  zoomMatchingRulesResponseSchema,
} from "@atlas/domain/reports/zoom-insights-roster.dto";
import {
  listZoomInsightsRosterMetadata,
  updateZoomMatchingRulesMetadata,
} from "@atlas/domain/reports/zoom-insights-roster.route-metadata";
import {
  getZoomMatchingRules,
  updateZoomMatchingRules,
} from "@atlas/domain/reports/zoom-insights-unmatched.service";

export const GET = createTenantRoute<
  z.output<typeof noBodySchema>,
  z.output<typeof zoomMatchingRulesResponseSchema>
>({
  metadata: listZoomInsightsRosterMetadata,
  input: noBodySchema,
  output: zoomMatchingRulesResponseSchema,
  handler: async ({ tx, ctx }) => getZoomMatchingRules(tx, ctx),
});

export const PATCH = createTenantRoute<
  z.output<typeof zoomMatchingRulesBodySchema>,
  z.output<typeof zoomMatchingRulesResponseSchema>
>({
  metadata: updateZoomMatchingRulesMetadata,
  input: zoomMatchingRulesBodySchema,
  output: zoomMatchingRulesResponseSchema,
  handler: async ({ tx, ctx, input }) => updateZoomMatchingRules(tx, ctx, input),
});
