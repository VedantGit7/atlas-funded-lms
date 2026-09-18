import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  liveSessionResponseSchema,
  updateLiveSessionBodySchema,
} from "@atlas/domain/live/live.dto";
import {
  deleteLiveSessionMetadata,
  getLiveSessionMetadata,
  updateLiveSessionMetadata,
} from "@atlas/domain/live/live.route-metadata";
import {
  deleteLiveSession,
  getLiveSession,
  updateLiveSession,
} from "@atlas/domain/live/live.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });
const deletedResponseSchema = zod.object({ data: zod.object({ deleted: zod.boolean() }) });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof liveSessionResponseSchema>,
  typeof paramsSchema
>({
  metadata: getLiveSessionMetadata,
  params: paramsSchema,
  output: liveSessionResponseSchema,
  handler: async ({ tx, ctx, params }) => getLiveSession(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateLiveSessionBodySchema>,
  z.output<typeof liveSessionResponseSchema>,
  typeof paramsSchema
>({
  metadata: updateLiveSessionMetadata,
  params: paramsSchema,
  input: updateLiveSessionBodySchema,
  output: liveSessionResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateLiveSession(tx, ctx, params["id"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deletedResponseSchema>,
  typeof paramsSchema
>({
  metadata: deleteLiveSessionMetadata,
  params: paramsSchema,
  output: deletedResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteLiveSession(tx, ctx, params["id"]),
});
