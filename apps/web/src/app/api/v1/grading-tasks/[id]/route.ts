import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getGradingTaskDetail } from "../../../../../server/grading/grading.service";
import {
  gradingTaskDetailResponseSchema,
  gradingTaskParamsSchema,
} from "../../../../../server/grading/grading-schemas";
import { getGradingTaskRouteMetadata } from "./route.metadata";

type GradingTaskDetailResponse = z.output<typeof gradingTaskDetailResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  GradingTaskDetailResponse,
  typeof gradingTaskParamsSchema
>({
  metadata: getGradingTaskRouteMetadata,
  params: gradingTaskParamsSchema,
  output: gradingTaskDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const taskId = params["id"];
    if (!taskId) throw new Error("Missing grading task id");

    return getGradingTaskDetail(tx, ctx, taskId);
  },
});
