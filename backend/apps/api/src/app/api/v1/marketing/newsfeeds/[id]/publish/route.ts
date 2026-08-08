import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { newsfeedPostResponseSchema } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.schemas";
import { mutateMarketingNewsfeedMetadata } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.route-metadata";
import { publishMarketingNewsfeedPost } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof newsfeedPostResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingNewsfeedMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: newsfeedPostResponseSchema,
  handler: async ({ tx, ctx, params }) => publishMarketingNewsfeedPost(tx, ctx, params["id"]),
});
