import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  PlatformRelinkDecisionResponseSchema,
  RelinkDecisionRequestSchema,
  RelinkRequestParamsSchema,
} from "../../../../../../../../server/platform-identity/account-review.schemas";
import { rejectRelinkRequest } from "../../../../../../../../server/platform-identity/account-review.service";
import { routeMetadata } from "./route.metadata";

/** Audit H6: refuse a relink. The earlier account stays as it is. */
const reject = createPlatformRoute({
  metadata: routeMetadata,
  params: RelinkRequestParamsSchema,
  body: RelinkDecisionRequestSchema,
  output: PlatformRelinkDecisionResponseSchema,
  handler: async ({ tx, ctx, params, body }) =>
    rejectRelinkRequest(
      tx,
      { platformPrincipalId: ctx.platformPrincipalId, requestId: ctx.requestId },
      params.id,
      body,
    ),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return reject(req, context);
}
