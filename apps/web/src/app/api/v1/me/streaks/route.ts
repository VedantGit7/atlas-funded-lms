import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { streakListResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { listMyStreaks } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type StreakListResponse = z.output<typeof streakListResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, StreakListResponse>({
  metadata: routeMetadata,
  output: streakListResponseSchema,
  handler: async ({ tx, ctx }) => listMyStreaks(tx, ctx),
});
