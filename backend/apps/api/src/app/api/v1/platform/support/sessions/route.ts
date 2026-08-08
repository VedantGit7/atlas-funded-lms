import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import {
  OpenSupportSessionRequestSchema,
  OpenSupportSessionResponseSchema,
  listActivePlatformSupportSessions,
  openPlatformSupportSession,
} from "@atlas/domain-tenancy";
import { postRouteMetadata, routeMetadata } from "./route.metadata";

const listQuerySchema = z.object({
  reason: z.string().min(10),
});

const listOutputSchema = z.object({
  data: z.array(z.unknown()),
});

export const GET = createPlatformRoute({
  metadata: { ...routeMetadata, audit: "none", idempotency: "none", reasonRequired: false },
  query: listQuerySchema,
  output: listOutputSchema,
  handler: async ({ tx }) => {
    const rows = await listActivePlatformSupportSessions(tx);
    return rows;
  },
});

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
