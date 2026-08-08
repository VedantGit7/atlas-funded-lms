import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { pollResponseSchema, updatePollBodySchema } from "@atlas/domain/polls/polls.dto";
import {
  deletePollMetadata,
  getPollMetadata,
  updatePollMetadata,
} from "@atlas/domain/polls/polls.route-metadata";
import { deletePoll, getPoll, updatePoll } from "@atlas/domain/polls/polls.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });
const deletedResponseSchema = zod.object({ data: zod.object({ deleted: zod.boolean() }) });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollResponseSchema>,
  typeof paramsSchema
>({
  metadata: getPollMetadata,
  params: paramsSchema,
  output: pollResponseSchema,
  handler: async ({ tx, ctx, params }) => getPoll(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updatePollBodySchema>,
  z.output<typeof pollResponseSchema>,
  typeof paramsSchema
>({
  metadata: updatePollMetadata,
  params: paramsSchema,
  input: updatePollBodySchema,
  output: pollResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updatePoll(tx, ctx, params["id"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deletedResponseSchema>,
  typeof paramsSchema
>({
  metadata: deletePollMetadata,
  params: paramsSchema,
  output: deletedResponseSchema,
  handler: async ({ tx, ctx, params }) => deletePoll(tx, ctx, params["id"]),
});
