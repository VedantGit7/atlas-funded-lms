import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createPollBodySchema,
  pollListResponseSchema,
  pollResponseSchema,
} from "@atlas/domain/polls/polls.dto";
import { createPollMetadata, listPollsMetadata } from "@atlas/domain/polls/polls.route-metadata";
import { createPoll, listPolls } from "@atlas/domain/polls/polls.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollListResponseSchema>
>({
  metadata: listPollsMetadata,
  output: pollListResponseSchema,
  handler: async ({ tx, ctx }) => listPolls(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createPollBodySchema>,
  z.output<typeof pollResponseSchema>
>({
  metadata: createPollMetadata,
  input: createPollBodySchema,
  output: pollResponseSchema,
  handler: async ({ tx, ctx, input }) => createPoll(tx, ctx, input),
});
