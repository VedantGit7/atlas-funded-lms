import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myRewardsResponseSchema } from "../../../../../server/gamification/rewards.schemas";
import { getMyRewards } from "../../../../../server/gamification/rewards.service";
import { getRouteMetadata } from "./route.metadata";

type MyRewardsResponse = z.output<typeof myRewardsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MyRewardsResponse>({
  metadata: getRouteMetadata,
  output: myRewardsResponseSchema,
  handler: async ({ tx, ctx }) => getMyRewards(tx, ctx),
});
