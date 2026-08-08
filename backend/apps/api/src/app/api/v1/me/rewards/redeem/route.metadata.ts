import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadSelfGamificationResourceRef } from "../../../../../../server/gamification/gamification.resource-loaders";

export const routeMetadata = {
  permission: "gamification.profile.read",
  entitlement: "gamification.enable",
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadSelfGamificationResourceRef({ ctx }),
} satisfies RouteMetadata;
