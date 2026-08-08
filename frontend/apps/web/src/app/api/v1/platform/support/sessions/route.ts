import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  OpenSupportSessionRequestSchema,
  OpenSupportSessionResponseSchema,
  openPlatformSupportSession,
} from "@atlas/domain-tenancy";
import { postRouteMetadata } from "./route.metadata";

export const POST = createPlatformRoute({
  metadata: postRouteMetadata,
  body: OpenSupportSessionRequestSchema,
  output: OpenSupportSessionResponseSchema,
  handler: async ({ tx, body, ctx }) =>
    openPlatformSupportSession(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      body,
    ),
});
