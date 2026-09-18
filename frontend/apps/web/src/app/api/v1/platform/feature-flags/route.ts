import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import {
  CreatePlatformFeatureFlagRequestSchema,
  PlatformFeatureFlagListResponseSchema,
  PlatformFeatureFlagViewSchema,
  listPlatformFeatureFlags,
  createPlatformFeatureFlag,
} from "@atlas/domain-config";
import { routeMetadata, postRouteMetadata } from "./route.metadata";

const PlatformFeatureFlagResponseSchema = z.object({
  data: PlatformFeatureFlagViewSchema,
});

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: PlatformFeatureFlagListResponseSchema,
  handler: async ({ tx }) => listPlatformFeatureFlags(tx),
});

export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: CreatePlatformFeatureFlagRequestSchema,
  output: PlatformFeatureFlagResponseSchema,
  handler: async ({ tx, body, ctx }) =>
    createPlatformFeatureFlag(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      {
        ...body,
        rolloutType: body.rolloutType,
      },
    ),
});
