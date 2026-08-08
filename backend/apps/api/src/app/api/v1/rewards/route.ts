import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  postRewardsBodySchema,
  rewardsAdminResponseSchema,
  rewardsMutationResponseSchema,
  updateRewardItemBodySchema,
} from "../../../../server/gamification/rewards.schemas";
import {
  getRewardsAdmin,
  mutateRewards,
  updateRewardItem,
} from "../../../../server/gamification/rewards.service";
import { getRouteMetadata, postRouteMetadata, putRouteMetadata } from "./route.metadata";

type RewardsAdminResponse = z.output<typeof rewardsAdminResponseSchema>;
type RewardsMutationResponse = z.output<typeof rewardsMutationResponseSchema>;
type PostRewardsBody = z.output<typeof postRewardsBodySchema>;
type UpdateRewardItemBody = z.output<typeof updateRewardItemBodySchema>;

export const GET = createTenantRoute<Record<string, never>, RewardsAdminResponse>({
  metadata: getRouteMetadata,
  output: rewardsAdminResponseSchema,
  handler: async ({ tx }) => getRewardsAdmin(tx),
});

export const POST = createTenantRoute<PostRewardsBody, RewardsMutationResponse>({
  metadata: postRouteMetadata,
  body: postRewardsBodySchema,
  output: rewardsMutationResponseSchema,
  handler: async ({ tx, ctx, input }) => mutateRewards(tx, ctx, input),
});

export const PUT = createTenantRoute<UpdateRewardItemBody, RewardsMutationResponse>({
  metadata: putRouteMetadata,
  body: updateRewardItemBodySchema,
  output: rewardsMutationResponseSchema,
  handler: async ({ tx, ctx, input }) => updateRewardItem(tx, ctx, input),
});
