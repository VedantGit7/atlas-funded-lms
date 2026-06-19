import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  CreateAssessmentBodySchema,
  ListAssessmentsQuerySchema,
} from "../../../../features/assessments/schemas";
import {
  assessmentDetailResponseSchema,
  assessmentListResponseSchema,
} from "../../../../features/assessments/assessment-response-schemas";
import {
  listAssessments,
  createAssessment,
} from "../../../../server/assessments/assessments.service";
import { getAssessmentsRouteMetadata, postAssessmentsRouteMetadata } from "./route.metadata";

type ListQuery = z.output<typeof ListAssessmentsQuerySchema>;
type CreateBody = z.output<typeof CreateAssessmentBodySchema>;

export const GET = createTenantRoute<ListQuery, z.output<typeof assessmentListResponseSchema>>({
  metadata: getAssessmentsRouteMetadata,
  input: ListAssessmentsQuerySchema,
  output: assessmentListResponseSchema,
  handler: async ({ tx, ctx, input }) => listAssessments(tx, ctx, input),
});

export const POST = createTenantRoute<CreateBody, z.output<typeof assessmentDetailResponseSchema>>({
  metadata: postAssessmentsRouteMetadata,
  body: CreateAssessmentBodySchema,
  output: assessmentDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const created = await createAssessment(tx, ctx, input);
    return created;
  },
});
