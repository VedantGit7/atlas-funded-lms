import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { PlatformRelinkRequestListResponseSchema } from "../../../../../../server/platform-identity/account-review.schemas";
import { listPendingRelinkRequests } from "../../../../../../server/platform-identity/account-review.service";
import { routeMetadata } from "./route.metadata";

/** Audit H6: sign-ins refused because a confirmed email reached an earlier account. */
export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: PlatformRelinkRequestListResponseSchema,
  handler: async ({ tx }) => listPendingRelinkRequests(tx),
});
