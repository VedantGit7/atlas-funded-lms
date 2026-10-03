import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  CostRateCardResponseSchema,
  CostRateResponseSchema,
  SetCostRateRequestSchema,
} from "@atlas/domain-config/schemas/cost-attribution";
import {
  getCostRateCard,
  setCostRate,
} from "@atlas/domain-config/services/cost-attribution.service";
import { postRouteMetadata, routeMetadata } from "./route.metadata";

/** The supplier rate card, its history, and the fixed cost lines. */
export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: CostRateCardResponseSchema,
  handler: async ({ tx }) => getCostRateCard(tx),
});

/**
 * Sets a driver's unit rate from a month onwards. Appends; never edits. A
 * mistyped rate is corrected by setting it again for the same month.
 */
export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: SetCostRateRequestSchema,
  output: CostRateResponseSchema,
  handler: async ({ tx, ctx, body }) =>
    setCostRate(
      tx,
      { platformPrincipalId: ctx.platformPrincipalId, requestId: ctx.requestId },
      body,
    ),
});
