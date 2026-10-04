import type { NextRequest } from "next/server";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  AccountParamsSchema,
  AccountStatusRequestSchema,
  PlatformAccountResponseSchema,
} from "../../../../../../../server/platform-identity/account-review.schemas";
import { setPlatformAccountStatus } from "../../../../../../../server/platform-identity/account-review.service";
import { routeMetadata } from "./route.metadata";

/**
 * Audit H6: disable or re-enable an account. A disabled account is refused at
 * sign-in, on every authenticated request, at every tenant's membership gate,
 * and any platform grant it holds confers nothing.
 */
const setStatus = createPlatformRoute({
  metadata: routeMetadata,
  params: AccountParamsSchema,
  body: AccountStatusRequestSchema,
  output: PlatformAccountResponseSchema,
  handler: async ({ tx, ctx, params, body }) =>
    setPlatformAccountStatus(
      tx,
      { platformPrincipalId: ctx.platformPrincipalId, requestId: ctx.requestId },
      params.id,
      body,
    ),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return setStatus(req, context);
}
