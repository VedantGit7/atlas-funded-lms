import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  redeemBodySchema,
  redeemResponseSchema,
} from "../../../../../../server/gamification/rewards.schemas";
import { redeemReward } from "../../../../../../server/gamification/rewards.service";
import { routeMetadata } from "./route.metadata";

type RedeemBody = z.output<typeof redeemBodySchema>;
type RedeemResponse = z.output<typeof redeemResponseSchema>;

export const POST = createTenantRoute<RedeemBody, RedeemResponse>({
  metadata: routeMetadata,
  body: redeemBodySchema,
  output: redeemResponseSchema,
  handler: async ({ tx, ctx, input }) => redeemReward(tx, ctx, input),
});
