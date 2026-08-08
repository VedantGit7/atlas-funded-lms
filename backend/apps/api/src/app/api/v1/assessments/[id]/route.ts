import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  AssessmentParamsSchema,
  GetAssessmentQuerySchema,
  UpdateAssessmentBodySchema,
} from "@atlas/api-server/assessments/schemas";
import {
  assessmentDeleteResponseSchema,
  assessmentDetailResponseSchema,
  learnerAssessmentOverviewResponseSchema,
} from "@atlas/api-server/assessments/assessment-response-schemas";
import {
  deleteAssessment,
  getAssessment,
  getLearnerAssessmentOverview,
  updateAssessment,
} from "../../../../../server/assessments/assessments.service";
import {
  deleteAssessmentRouteMetadata,
  getAssessmentRouteMetadata,
  putAssessmentRouteMetadata,
} from "./route.metadata";

type UpdateBody = z.output<typeof UpdateAssessmentBodySchema>;
type GetQuery = z.output<typeof GetAssessmentQuerySchema>;

const assessmentGetResponseSchema = z.union([
  assessmentDetailResponseSchema,
  learnerAssessmentOverviewResponseSchema,
]);

export const GET = createTenantRoute<
  GetQuery,
  z.output<typeof assessmentGetResponseSchema>,
  typeof AssessmentParamsSchema
>({
  metadata: getAssessmentRouteMetadata,
  params: AssessmentParamsSchema,
  input: GetAssessmentQuerySchema,
  output: assessmentGetResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    if (input.view === "learner") {
      return getLearnerAssessmentOverview(tx, ctx, assessmentId);
    }
    return getAssessment(tx, ctx, assessmentId);
  },
});

export const PUT = createTenantRoute<
  UpdateBody,
  z.output<typeof assessmentDetailResponseSchema>,
  typeof AssessmentParamsSchema
>({
  metadata: putAssessmentRouteMetadata,
  params: AssessmentParamsSchema,
  body: UpdateAssessmentBodySchema,
  output: assessmentDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return updateAssessment(tx, ctx, assessmentId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof assessmentDeleteResponseSchema>,
  typeof AssessmentParamsSchema
>({
  metadata: deleteAssessmentRouteMetadata,
  params: AssessmentParamsSchema,
  output: assessmentDeleteResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return deleteAssessment(tx, ctx, assessmentId);
  },
});
