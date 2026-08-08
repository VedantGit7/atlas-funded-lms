import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { gamificationExportResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { exportGamificationConfig } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type GamificationExportResponse = z.output<typeof gamificationExportResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, GamificationExportResponse>({
  metadata: routeMetadata,
  output: gamificationExportResponseSchema,
  handler: async ({ tx }) => exportGamificationConfig(tx),
});
