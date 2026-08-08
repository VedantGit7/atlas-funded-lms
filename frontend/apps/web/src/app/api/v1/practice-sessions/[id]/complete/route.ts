import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  completePracticeSessionResponseSchema,
  CompletePracticeSessionBodySchema,
  PracticeSessionParamsSchema,
} from "../../../../../../server/practice/practice.schemas";
import { completePracticeSession } from "../../../../../../server/practice/practice.service";
import { completeSessionRouteMetadata } from "./route.metadata";

export const POST = createTenantRoute<
  z.output<typeof CompletePracticeSessionBodySchema>,
  z.output<typeof completePracticeSessionResponseSchema>,
  typeof PracticeSessionParamsSchema
>({
  metadata: completeSessionRouteMetadata,
  params: PracticeSessionParamsSchema,
  body: CompletePracticeSessionBodySchema,
  output: completePracticeSessionResponseSchema,
  handler: async ({ tx, ctx, params }) => {
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

    return completePracticeSession(tx, ctx, sessionId, idempotencyKey);
  },
});
