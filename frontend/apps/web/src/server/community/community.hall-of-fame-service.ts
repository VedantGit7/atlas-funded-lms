import type { TenantTx } from "@atlas/db";
import { findActiveEntitlementByKey } from "@atlas/domain-config";
import { getLeaderboardDetail } from "../gamification/gamification.service";
import { listPostsInSpace, resolveHallOfFameConfig } from "./community.service";
import type { ServiceCtx } from "./community.types";

export type HallOfFameProjection = {
  recognitionFeed: Awaited<ReturnType<typeof listPostsInSpace>> | null;
  leaderboard: Awaited<ReturnType<typeof getLeaderboardDetail>> | null;
  gamificationAvailable: boolean;
};

export async function buildHallOfFameProjection(
  tx: TenantTx,
  ctx: ServiceCtx,
): Promise<HallOfFameProjection> {
  const config = await resolveHallOfFameConfig(tx);

  let recognitionFeed: HallOfFameProjection["recognitionFeed"] = null;
  if (config.recognitionSpaceId) {
    recognitionFeed = await listPostsInSpace(tx, ctx, config.recognitionSpaceId);
  }

  const gamificationEntitlement = await findActiveEntitlementByKey(tx, "gamification.enable");
  const gamificationAvailable = Boolean(gamificationEntitlement);

  let leaderboard: HallOfFameProjection["leaderboard"] = null;
  if (gamificationAvailable && config.leaderboardId) {
    leaderboard = await getLeaderboardDetail(tx, ctx, config.leaderboardId);
  }

  return {
    recognitionFeed,
    leaderboard,
    gamificationAvailable,
  };
}

export function extractVerificationLinksFromPosts(
  feed: HallOfFameProjection["recognitionFeed"],
): string[] {
  if (!feed) return [];

  const links = new Set<string>();

  for (const post of feed.data.items) {
    for (const block of post.bodyJson.blocks) {
      for (const child of block.children) {
        if (child.type === "verify_link") {
          links.add(`/verify/${child.credentialId}`);
        }
      }
    }
  }

  return [...links];
}
