import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { badgeProgressResponseSchema } from "../../../../../../server/gamification/gamification.schemas";
import { listMyBadgeProgress } from "../../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type BadgeProgressResponse = z.output<typeof badgeProgressResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, BadgeProgressResponse>({
  metadata: routeMetadata,
  output: badgeProgressResponseSchema,
  handler: async ({ tx, ctx }) => listMyBadgeProgress(tx, ctx),
});
