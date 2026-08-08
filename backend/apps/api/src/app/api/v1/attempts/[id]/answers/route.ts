import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  AttemptParamsSchema,
  SaveAnswerBodySchema,
} from "@atlas/api-server/assessments/schemas";
import { saveAnswerResponseSchema } from "@atlas/api-server/assessments/assessment-response-schemas";
import { saveAttemptAnswer } from "../../../../../../server/attempts/attempts.service";
import { saveAnswerRouteMetadata } from "./route.metadata";

type SaveBody = z.output<typeof SaveAnswerBodySchema>;

export const POST = createTenantRoute<
  SaveBody,
  z.output<typeof saveAnswerResponseSchema>,
  typeof AttemptParamsSchema
>({
  metadata: saveAnswerRouteMetadata,
  params: AttemptParamsSchema,
  body: SaveAnswerBodySchema,
  output: saveAnswerResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
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
    return saveAttemptAnswer(tx, ctx, attemptId, input, idempotencyKey);
  },
});
