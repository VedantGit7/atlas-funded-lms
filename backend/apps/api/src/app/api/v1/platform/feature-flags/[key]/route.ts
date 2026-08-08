import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import {
  PlatformFeatureFlagParamsSchema,
  PlatformFeatureFlagViewSchema,
  UpdatePlatformFeatureFlagRequestSchema,
  updatePlatformFeatureFlag,
} from "@atlas/domain-config";
import { routeMetadata } from "./route.metadata";

const PlatformFeatureFlagResponseSchema = z.object({
  data: PlatformFeatureFlagViewSchema,
});

const putFlag = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformFeatureFlagParamsSchema,
  body: UpdatePlatformFeatureFlagRequestSchema,
  output: PlatformFeatureFlagResponseSchema,
  handler: async ({ tx, params, body, ctx }) =>
    updatePlatformFeatureFlag(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      params.key,
      body,
    ),
});

export async function PUT(
  req: Parameters<typeof putFlag>[0],
  context: Parameters<typeof putFlag>[1],
) {
  return putFlag(req, context);
}
