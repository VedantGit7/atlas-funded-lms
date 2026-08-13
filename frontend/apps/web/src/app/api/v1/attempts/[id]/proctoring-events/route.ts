import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import { AttemptParamsSchema } from "../../../../../../features/assessments/schemas";
import {
  ingestProctoringEventsBodySchema,
  ingestProctoringEventsResponseSchema,
} from "../../../../../../server/proctoring/proctoring.schemas";
import { ingestProctoringEvents } from "../../../../../../server/proctoring/proctoring.service";
import { ingestProctoringEventsRouteMetadata } from "./route.metadata";

type IngestBody = z.output<typeof ingestProctoringEventsBodySchema>;

export const POST = createTenantRoute<
  IngestBody,
  z.output<typeof ingestProctoringEventsResponseSchema>,
  typeof AttemptParamsSchema
>({
  metadata: ingestProctoringEventsRouteMetadata,
  params: AttemptParamsSchema,
  body: ingestProctoringEventsBodySchema,
  output: ingestProctoringEventsResponseSchema,
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
    return ingestProctoringEvents(tx, ctx, attemptId, input, idempotencyKey);
  },
});
