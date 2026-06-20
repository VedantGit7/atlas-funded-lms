import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  StartPracticeSessionBodySchema,
  startPracticeSessionResponseSchema,
} from "../../../../server/practice/practice.schemas";
import { startPracticeSession } from "../../../../server/practice/practice.service";
import { routeMetadata } from "./route.metadata";

type StartBody = z.output<typeof StartPracticeSessionBodySchema>;

export const POST = createTenantRoute<
  StartBody,
  z.output<typeof startPracticeSessionResponseSchema>
>({
  metadata: routeMetadata,
  body: StartPracticeSessionBodySchema,
  output: startPracticeSessionResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const idempotencyKey = ctx.idempotencyKey;
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }

    return startPracticeSession(tx, ctx, input, idempotencyKey);
  },
});
