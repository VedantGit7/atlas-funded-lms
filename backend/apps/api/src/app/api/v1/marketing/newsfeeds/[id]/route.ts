import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import {
  newsfeedPostResponseSchema,
  updateNewsfeedPostBodySchema,
} from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.schemas";
import {
  listMarketingNewsfeedMetadata,
  mutateMarketingNewsfeedMetadata,
} from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.route-metadata";
import {
  getMarketingNewsfeedPost,
  updateMarketingNewsfeedPost,
} from "../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  undefined,
  z.output<typeof newsfeedPostResponseSchema>,
  typeof paramsSchema
>({
  metadata: listMarketingNewsfeedMetadata,
  params: paramsSchema,
  output: newsfeedPostResponseSchema,
  handler: async ({ tx, ctx, params }) => getMarketingNewsfeedPost(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateNewsfeedPostBodySchema>,
  z.output<typeof newsfeedPostResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMarketingNewsfeedMetadata,
  params: paramsSchema,
  body: updateNewsfeedPostBodySchema,
  output: newsfeedPostResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    updateMarketingNewsfeedPost(tx, ctx, params["id"], input),
});
