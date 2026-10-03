import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  EndFixedCostRequestSchema,
  FixedCostParamsSchema,
  FixedCostResponseSchema,
} from "@atlas/domain-config/schemas/cost-attribution";
import { endFixedCost } from "@atlas/domain-config/services/cost-attribution.service";
import { routeMetadata } from "./route.metadata";

/**
 * Ends a fixed cost line after a given month. Lines are ended rather than
 * deleted, so the months they applied to keep reporting them.
 */
const endLine = createPlatformRoute({
  metadata: routeMetadata,
  params: FixedCostParamsSchema,
  body: EndFixedCostRequestSchema,
  output: FixedCostResponseSchema,
  handler: async ({ tx, ctx, params, body }) =>
    endFixedCost(
      tx,
      { platformPrincipalId: ctx.platformPrincipalId, requestId: ctx.requestId },
      params.id,
      body,
    ),
});

export async function POST(
  req: Parameters<typeof endLine>[0],
  context: Parameters<typeof endLine>[1],
) {
  return endLine(req, context);
}
