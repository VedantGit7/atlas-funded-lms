import type { z } from "zod";
import type { postListResponseSchema, spaceListResponseSchema } from "@atlas/contracts/community/community.dto";
import type {
  leaderboardDetailResponseSchema,
  leaderboardListResponseSchema,
} from "@atlas/contracts/gamification/gamification.schemas";
import { ServerApiError } from "../server-api";
import { communityServerApi } from "@atlas/contracts-modules/community/community.server-api";
import { gamificationServerApi } from "@atlas/contracts-modules/gamification/gamification.server-api";

type PostListResponse = z.infer<typeof postListResponseSchema>;
type SpaceListResponse = z.infer<typeof spaceListResponseSchema>;
type LeaderboardDetailResponse = z.infer<typeof leaderboardDetailResponseSchema>;
type LeaderboardBoard = z.infer<typeof leaderboardListResponseSchema>["data"]["items"][number];

export type HallOfFameProjection = {
  recognitionFeed: PostListResponse | null;
  leaderboard: LeaderboardDetailResponse | null;
  boards: LeaderboardBoard[];
  gamificationAvailable: boolean;
};

// Recognition spaces follow a naming convention (the admin config points at one
// of these). Resolving server-side keeps client ids out of the request while
// degrading to a clean empty state when no dedicated space exists.
const RECOGNITION_SPACE_PATTERN = /(recognition|hall[-_ ]?of[-_ ]?fame|wall[-_ ]?of[-_ ]?fame|honou?rs?|fame)/i;

function isMissingOrForbidden(error: unknown): boolean {
  return (
    error instanceof ServerApiError &&
    (error.code === "ENTITLEMENT_REQUIRED" ||
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404)
  );
}

async function loadLeaderboards(): Promise<{ boards: LeaderboardBoard[]; available: boolean }> {
  try {
    const response = await gamificationServerApi.listLeaderboards();
    const boards = response.data.items.filter(
      (board) => board.status === "ACTIVE" && board.config.scopeType === "tenant",
    );
    return { boards, available: true };
  } catch (error) {
    if (isMissingOrForbidden(error)) return { boards: [], available: false };
    throw error;
  }
}

async function loadLeaderboardDetail(id: string): Promise<LeaderboardDetailResponse | null> {
  try {
    return await gamificationServerApi.getLeaderboard(id);
  } catch (error) {
    if (isMissingOrForbidden(error)) return null;
    throw error;
  }
}

async function loadRecognitionFeed(): Promise<PostListResponse | null> {
  let spaces: SpaceListResponse;
  try {
    spaces = await communityServerApi.listSpaces();
  } catch (error) {
    if (isMissingOrForbidden(error)) return null;
    throw error;
  }

  const space = spaces.data.items.find(
    (item) => RECOGNITION_SPACE_PATTERN.test(item.slug) || RECOGNITION_SPACE_PATTERN.test(item.name),
  );
  if (!space) return null;

  try {
    return await communityServerApi.listSpacePosts(space.id);
  } catch (error) {
    if (isMissingOrForbidden(error)) return null;
    throw error;
  }
}

export async function loadHallOfFamePageData(): Promise<HallOfFameProjection> {
  const [{ boards, available }, recognitionFeed] = await Promise.all([
    loadLeaderboards(),
    loadRecognitionFeed(),
  ]);

  const primaryBoard = boards.find((board) => board.windowKey === "all_time") ?? boards[0] ?? null;
  const leaderboard = primaryBoard ? await loadLeaderboardDetail(primaryBoard.id) : null;

  return {
    recognitionFeed,
    leaderboard,
    boards,
    gamificationAvailable: available,
  };
}
