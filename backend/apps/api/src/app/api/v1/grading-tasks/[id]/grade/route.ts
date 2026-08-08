import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { gradeGradingTask } from "../../../../../../server/grading/grading.service";
import {
  gradeTaskBodySchema,
  gradeTaskResultSchema,
  gradingTaskParamsSchema,
} from "../../../../../../server/grading/grading-schemas";
import { postGradeGradingTaskRouteMetadata } from "./route.metadata";

type GradeTaskBody = z.output<typeof gradeTaskBodySchema>;
type GradeTaskResponse = z.output<typeof gradeTaskResultSchema>;

export const POST = createTenantRoute<
  GradeTaskBody,
  GradeTaskResponse,
  typeof gradingTaskParamsSchema
>({
  metadata: postGradeGradingTaskRouteMetadata,
  params: gradingTaskParamsSchema,
  body: gradeTaskBodySchema,
  output: gradeTaskResultSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const taskId = params["id"];
    if (!taskId) throw new Error("Missing grading task id");

    return gradeGradingTask(tx, ctx, taskId, input);
  },
});
