import type { NextRequest } from "next/server";
import { z } from "zod";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { replayDeadLetterEvent } from "@atlas/events";
import { routeMetadata } from "./route.metadata";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const ReplayResponseSchema = z.object({
  data: z.object({
    replayedOutboxEventId: z.string().uuid(),
  }),
});

const replayDeadLetter = createPlatformRoute({
  metadata: routeMetadata,
  params: ParamsSchema,
  output: ReplayResponseSchema,
  handler: async ({ tx, params, ctx }) => {
    const result = await replayDeadLetterEvent(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
        idempotencyKey: ctx.idempotencyKey,
      },
      {
        deadLetterId: params.id,
      },
    );

    return {
      data: result,
    };
  },
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return replayDeadLetter(req, context);
}
