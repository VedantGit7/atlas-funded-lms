import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  PracticeSessionParamsSchema,
  SubmitPracticeResponseBodySchema,
  submitPracticeResponseResponseSchema,
} from "../../../../../../server/practice/practice.schemas";
import { submitPracticeResponse } from "../../../../../../server/practice/practice.service";
import { submitResponseRouteMetadata } from "./route.metadata";

type SubmitBody = z.output<typeof SubmitPracticeResponseBodySchema>;

export const POST = createTenantRoute<
  SubmitBody,
  z.output<typeof submitPracticeResponseResponseSchema>,
  typeof PracticeSessionParamsSchema
>({
  metadata: submitResponseRouteMetadata,
  params: PracticeSessionParamsSchema,
  body: SubmitPracticeResponseBodySchema,
  output: submitPracticeResponseResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const idempotencyKey = ctx.idempotencyKey;
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }

    const sessionId = params["id"];
    if (!sessionId) throw new Error("Missing practice session id");

    return submitPracticeResponse(tx, ctx, sessionId, input, idempotencyKey);
  },
});
