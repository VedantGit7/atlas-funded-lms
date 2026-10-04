import { createPlatformRoute } from "@atlas/api/create-platform-route";
import {
  AccountLookupQuerySchema,
  PlatformAccountLookupResponseSchema,
} from "../../../../../server/platform-identity/account-review.schemas";
import { lookupPlatformAccount } from "../../../../../server/platform-identity/account-review.service";
import { routeMetadata } from "./route.metadata";

/** Audit H6: find the account behind an email, for review or status changes. */
export const GET = createPlatformRoute({
  metadata: routeMetadata,
  query: AccountLookupQuerySchema,
  output: PlatformAccountLookupResponseSchema,
  handler: async ({ tx, query }) => lookupPlatformAccount(tx, query.email),
});
