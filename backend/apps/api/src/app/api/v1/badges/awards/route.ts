import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  badgeAwardsListResponseSchema,
  badgeAwardsQuerySchema,
} from "../../../../../server/gamification/gamification.schemas";
import { listBadgeAwardHistory } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type BadgeAwardsQuery = z.output<typeof badgeAwardsQuerySchema>;
type BadgeAwardsListResponse = z.output<typeof badgeAwardsListResponseSchema>;

export const GET = createTenantRoute<BadgeAwardsQuery, BadgeAwardsListResponse>({
  metadata: routeMetadata,
  input: badgeAwardsQuerySchema,
  output: badgeAwardsListResponseSchema,
  handler: async ({ tx, input }) => listBadgeAwardHistory(tx, input),
});
