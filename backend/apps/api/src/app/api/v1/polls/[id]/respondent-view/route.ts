import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { pollRespondentViewResponseSchema } from "@atlas/domain/polls/polls.dto";
import { getPollRespondentViewMetadata } from "@atlas/domain/polls/polls.route-metadata";
import { getPollForRespondent } from "@atlas/domain/polls/polls.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollRespondentViewResponseSchema>,
  typeof paramsSchema
>({
  metadata: getPollRespondentViewMetadata,
  params: paramsSchema,
  output: pollRespondentViewResponseSchema,
  handler: async ({ tx, ctx, params }) => getPollForRespondent(tx, ctx, params["id"]),
});
