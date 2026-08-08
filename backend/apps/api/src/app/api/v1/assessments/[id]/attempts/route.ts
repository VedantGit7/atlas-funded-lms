import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  AssessmentParamsSchema,
  StartAttemptBodySchema,
} from "@atlas/api-server/assessments/schemas";
import { startAttemptResponseSchema } from "@atlas/api-server/assessments/assessment-response-schemas";
import { startAttempt } from "../../../../../../server/attempts/attempts.service";
import { startAttemptRouteMetadata } from "./route.metadata";

type StartBody = z.output<typeof StartAttemptBodySchema>;

export const POST = createTenantRoute<
  StartBody,
  z.output<typeof startAttemptResponseSchema>,
  typeof AssessmentParamsSchema
>({
  metadata: startAttemptRouteMetadata,
  params: AssessmentParamsSchema,
  body: StartAttemptBodySchema,
  output: startAttemptResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const assessmentId = params["id"];
    if (!assessmentId) throw new Error("Missing assessment id");
    const idempotencyKey = ctx.idempotencyKey;
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }

    return startAttempt(tx, ctx, assessmentId, idempotencyKey);
  },
});
