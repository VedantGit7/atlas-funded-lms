import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  AttemptParamsSchema,
  SubmitAttemptBodySchema,
} from "@atlas/api-server/assessments/schemas";
import { submitAttemptResponseSchema } from "@atlas/api-server/assessments/assessment-response-schemas";
import { submitAttempt } from "../../../../../../server/attempts/attempts.service";
import { submitAttemptRouteMetadata } from "./route.metadata";

type SubmitBody = z.output<typeof SubmitAttemptBodySchema>;

export const POST = createTenantRoute<
  SubmitBody,
  z.output<typeof submitAttemptResponseSchema>,
  typeof AttemptParamsSchema
>({
  metadata: submitAttemptRouteMetadata,
  params: AttemptParamsSchema,
  body: SubmitAttemptBodySchema,
  output: submitAttemptResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const idempotencyKey = ctx.idempotencyKey;
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }

    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return submitAttempt(tx, ctx, attemptId, idempotencyKey);
  },
});
