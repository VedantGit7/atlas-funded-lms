import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  badgeDetailResponseSchema,
  badgeListResponseSchema,
  postBadgesBodySchema,
  updateBadgeBodySchema,
} from "../../../../server/gamification/gamification.schemas";
import {
  listBadges,
  mutateBadges,
  updateBadge,
} from "../../../../server/gamification/gamification.service";
import { getRouteMetadata, postRouteMetadata, putRouteMetadata } from "./route.metadata";

type BadgeListResponse = z.output<typeof badgeListResponseSchema>;
type BadgeDetailResponse = z.output<typeof badgeDetailResponseSchema>;
type PostBadgesBody = z.output<typeof postBadgesBodySchema>;
type UpdateBadgeBody = z.output<typeof updateBadgeBodySchema>;

export const GET = createTenantRoute<Record<string, never>, BadgeListResponse>({
  metadata: getRouteMetadata,
  output: badgeListResponseSchema,
  handler: async ({ tx, ctx }) => listBadges(tx, ctx),
});

export const POST = createTenantRoute<PostBadgesBody, BadgeDetailResponse>({
  metadata: postRouteMetadata,
  body: postBadgesBodySchema,
  output: badgeDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => mutateBadges(tx, ctx, input),
});

export const PUT = createTenantRoute<UpdateBadgeBody, BadgeDetailResponse>({
  metadata: putRouteMetadata,
  body: updateBadgeBodySchema,
  output: badgeDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateBadge(tx, ctx, input),
});
