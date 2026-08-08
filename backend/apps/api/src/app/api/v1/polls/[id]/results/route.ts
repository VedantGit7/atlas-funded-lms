import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { pollResultsResponseSchema } from "@atlas/domain/polls/polls.dto";
import { getPollResultsMetadata } from "@atlas/domain/polls/polls.route-metadata";
import { getPollResults } from "@atlas/domain/polls/polls.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollResultsResponseSchema>,
  typeof paramsSchema
>({
  metadata: getPollResultsMetadata,
  params: paramsSchema,
  output: pollResultsResponseSchema,
  handler: async ({ tx, ctx, params }) => getPollResults(tx, ctx, params.id),
});
