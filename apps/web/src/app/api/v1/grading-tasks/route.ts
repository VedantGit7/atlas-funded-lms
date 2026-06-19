import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listGradingTasks } from "../../../../server/grading/grading.service";
import {
  gradingListQuerySchema,
  gradingListResponseSchema,
} from "../../../../server/grading/grading-schemas";
import { getGradingTasksRouteMetadata } from "./route.metadata";

type GradingListQuery = z.output<typeof gradingListQuerySchema>;
type GradingListResponse = z.output<typeof gradingListResponseSchema>;

export const GET = createTenantRoute<GradingListQuery, GradingListResponse>({
  metadata: getGradingTasksRouteMetadata,
  input: gradingListQuerySchema,
  output: gradingListResponseSchema,
  handler: async ({ tx, ctx, input }) => listGradingTasks(tx, ctx, input),
});
