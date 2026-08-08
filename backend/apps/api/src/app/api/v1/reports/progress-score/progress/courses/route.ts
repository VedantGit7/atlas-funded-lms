import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  progressProductsListResponseSchema,
  progressProductsQuerySchema,
} from "@atlas/domain/reports/progress-score-roster.dto";
import { listProgressScoreRosterMetadata } from "@atlas/domain/reports/progress-score-roster.route-metadata";
import { listProgressCourses } from "@atlas/domain/reports/progress-score-roster.service";

export const GET = createTenantRoute<
  z.output<typeof progressProductsQuerySchema>,
  z.output<typeof progressProductsListResponseSchema>
>({
  metadata: listProgressScoreRosterMetadata,
  input: progressProductsQuerySchema,
  output: progressProductsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listProgressCourses(tx, ctx, input),
});
