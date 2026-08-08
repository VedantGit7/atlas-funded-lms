import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLeaderboardDetailResourceRef } from "../../../../../server/gamification/gamification.resource-loaders";

export const routeMetadata = {
  permission: "leaderboard.read",
  entitlement: "gamification.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const leaderboardId = params["id"];
    if (!leaderboardId) {
      throw new Error("Missing leaderboard id.");
    }

    return loadLeaderboardDetailResourceRef({
      tx,
      ctx,
      leaderboardId,
    });
  },
} satisfies RouteMetadata;
