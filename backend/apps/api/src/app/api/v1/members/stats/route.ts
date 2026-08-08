import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getMemberStats, memberStatsResponseSchema } from "@atlas/membership";
import { getRouteMetadata } from "./route.metadata";

type MemberStatsResponse = z.output<typeof memberStatsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MemberStatsResponse>({
  metadata: getRouteMetadata,
  output: memberStatsResponseSchema,
  handler: async ({ tx, ctx }) => getMemberStats(tx, ctx),
});
