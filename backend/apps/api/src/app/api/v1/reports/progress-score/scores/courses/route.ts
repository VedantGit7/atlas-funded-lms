import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  scoreProductsListResponseSchema,
  scoreProductsQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listScoreCourses } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof scoreProductsQuerySchema>,
  z.output<typeof scoreProductsListResponseSchema>
>({
  metadata: listProgressScoreRosterMetadata,
  input: scoreProductsQuerySchema,
  output: scoreProductsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listScoreCourses(tx, ctx, input),
});
