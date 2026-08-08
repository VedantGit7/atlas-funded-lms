import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  deleteNewsfeedPostBodySchema,
  deleteNewsfeedPostResponseSchema,
} from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.schemas";
import { mutateMarketingNewsfeedMetadata } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.route-metadata";
import { deleteMarketingNewsfeedPost } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const POST = createTenantRoute<
  z.output<typeof deleteNewsfeedPostBodySchema>,
  z.output<typeof deleteNewsfeedPostResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingNewsfeedMetadata,
  params: paramsSchema,
  body: deleteNewsfeedPostBodySchema,
  output: deleteNewsfeedPostResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    deleteMarketingNewsfeedPost(tx, ctx, params["id"], input),
});
