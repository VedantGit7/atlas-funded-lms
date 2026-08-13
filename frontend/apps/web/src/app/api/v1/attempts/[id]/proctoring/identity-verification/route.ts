import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import { AttemptParamsSchema } from "../../../../../../../features/assessments/schemas";
import {
  identityVerificationBodySchema,
  identityVerificationResponseSchema,
} from "../../../../../../../server/proctoring/proctoring.schemas";
import { submitIdentityVerification } from "../../../../../../../server/proctoring/proctoring.service";
import { identityVerificationRouteMetadata } from "./route.metadata";

type Body = z.output<typeof identityVerificationBodySchema>;

export const POST = createTenantRoute<
  Body,
  z.output<typeof identityVerificationResponseSchema>,
  typeof AttemptParamsSchema
>({
  metadata: identityVerificationRouteMetadata,
  params: AttemptParamsSchema,
  body: identityVerificationBodySchema,
  output: identityVerificationResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const idempotencyKey = ctx.idempotencyKey;
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }
    void idempotencyKey;

    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return submitIdentityVerification(tx, ctx, attemptId, input);
  },
});
