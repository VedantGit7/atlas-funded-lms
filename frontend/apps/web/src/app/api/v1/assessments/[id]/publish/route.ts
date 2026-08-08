import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  AssessmentParamsSchema,
  PublishAssessmentBodySchema,
} from "../../../../../../features/assessments/schemas";
import { assessmentPublishResponseSchema } from "../../../../../../features/assessments/assessment-response-schemas";
import { submitAssessmentForReview } from "../../../../../../server/assessments/assessments.service";
import { publishAssessmentRouteMetadata } from "./route.metadata";

type PublishBody = z.output<typeof PublishAssessmentBodySchema>;

export const POST = createTenantRoute<
  PublishBody,
  z.output<typeof assessmentPublishResponseSchema>,
  typeof AssessmentParamsSchema
>({
  metadata: publishAssessmentRouteMetadata,
  params: AssessmentParamsSchema,
  body: PublishAssessmentBodySchema,
  output: assessmentPublishResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    return submitAssessmentForReview(tx, ctx, assessmentId, {
      ...(input.reason != null ? { reason: input.reason } : {}),
    });
  },
});
