import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  PlatformRelinkDecisionResponseSchema,
  RelinkDecisionRequestSchema,
  RelinkRequestParamsSchema,
} from "../../../../../../../../server/platform-identity/account-review.schemas";
import { approveRelinkRequest } from "../../../../../../../../server/platform-identity/account-review.service";
import { routeMetadata } from "./route.metadata";

/**
 * Audit H6: move an account to its new sign-in. Refused unless the earlier
 * Supabase user is deleted and the new one holds the same confirmed email.
 * Any platform grant is revoked, never carried across.
 */
const approve = createPlatformRoute({
  metadata: routeMetadata,
  params: RelinkRequestParamsSchema,
  body: RelinkDecisionRequestSchema,
  output: PlatformRelinkDecisionResponseSchema,
  handler: async ({ tx, ctx, params, body }) =>
    approveRelinkRequest(
      tx,
      { platformPrincipalId: ctx.platformPrincipalId, requestId: ctx.requestId },
      params.id,
      body,
    ),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return approve(req, context);
}
