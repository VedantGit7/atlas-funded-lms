import type { z } from "zod";
import { z as zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  leaderboardDefinitionDtoSchema,
  leaderboardListResponseSchema,
  postLeaderboardsBodySchema,
  updateLeaderboardBodySchema,
} from "../../../../server/gamification/gamification.schemas";
import {
  createLeaderboard,
  listLeaderboards,
  updateLeaderboard,
} from "../../../../server/gamification/gamification.service";
import { getRouteMetadata, postRouteMetadata, putRouteMetadata } from "./route.metadata";

type LeaderboardListResponse = z.output<typeof leaderboardListResponseSchema>;
type PostLeaderboardsBody = z.output<typeof postLeaderboardsBodySchema>;
type UpdateLeaderboardBody = z.output<typeof updateLeaderboardBodySchema>;

const leaderboardDefinitionResponseSchema = zod.object({
  data: leaderboardDefinitionDtoSchema,
});

export const GET = createTenantRoute<Record<string, never>, LeaderboardListResponse>({
  metadata: getRouteMetadata,
  output: leaderboardListResponseSchema,
  handler: async ({ tx }) => listLeaderboards(tx),
});

export const POST = createTenantRoute<
  PostLeaderboardsBody,
  z.output<typeof leaderboardDefinitionResponseSchema>
>({
  metadata: postRouteMetadata,
  body: postLeaderboardsBodySchema,
  output: leaderboardDefinitionResponseSchema,
  handler: async ({ tx, ctx, input }) => createLeaderboard(tx, ctx, input),
});

export const PUT = createTenantRoute<
  UpdateLeaderboardBody,
  z.output<typeof leaderboardDefinitionResponseSchema>
>({
  metadata: putRouteMetadata,
  body: updateLeaderboardBodySchema,
  output: leaderboardDefinitionResponseSchema,
  handler: async ({ tx, ctx, input }) => updateLeaderboard(tx, ctx, input),
});
