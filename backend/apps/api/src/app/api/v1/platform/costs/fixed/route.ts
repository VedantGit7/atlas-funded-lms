import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  CreateFixedCostRequestSchema,
  FixedCostResponseSchema,
} from "@atlas/domain-config/schemas/cost-attribution";
import { createFixedCost } from "@atlas/domain-config/services/cost-attribution.service";
import { routeMetadata } from "./route.metadata";

/** Adds a fixed monthly cost line and the key it is shared out by. */
export const POST = createPlatformRoute({
  metadata: routeMetadata,
  body: CreateFixedCostRequestSchema,
  output: FixedCostResponseSchema,
  handler: async ({ tx, ctx, body }) =>
    createFixedCost(
      tx,
      { platformPrincipalId: ctx.platformPrincipalId, requestId: ctx.requestId },
      body,
    ),
});
