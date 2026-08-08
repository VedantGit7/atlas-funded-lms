import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createLiveSessionBodySchema,
  liveSessionListResponseSchema,
  liveSessionResponseSchema,
} from "@atlas/domain/live/live.dto";
import {
  createLiveSessionMetadata,
  listLiveSessionsMetadata,
} from "@atlas/domain/live/live.route-metadata";
import { createLiveSession, listLiveSessions } from "@atlas/domain/live/live.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveSessionListResponseSchema>
>({
  metadata: listLiveSessionsMetadata,
  output: liveSessionListResponseSchema,
  handler: async ({ tx, ctx }) => listLiveSessions(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createLiveSessionBodySchema>,
  z.output<typeof liveSessionResponseSchema>
>({
  metadata: createLiveSessionMetadata,
  input: createLiveSessionBodySchema,
  output: liveSessionResponseSchema,
  handler: async ({ tx, ctx, input }) => createLiveSession(tx, ctx, input),
});
