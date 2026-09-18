import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { respondPollBodySchema, respondPollResponseSchema } from "@atlas/domain/polls/polls.dto";
import { respondPollMetadata } from "@atlas/domain/polls/polls.route-metadata";
import { respondToPoll } from "@atlas/domain/polls/polls.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof respondPollBodySchema>,
  z.output<typeof respondPollResponseSchema>,
  typeof paramsSchema
>({
  metadata: respondPollMetadata,
  params: paramsSchema,
  input: respondPollBodySchema,
  output: respondPollResponseSchema,
  handler: async ({ tx, ctx, params, input }) => respondToPoll(tx, ctx, params["id"], input),
});
