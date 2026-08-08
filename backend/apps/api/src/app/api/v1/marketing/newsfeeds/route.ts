import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createNewsfeedPostBodySchema,
  newsfeedPostResponseSchema,
  newsfeedPostsListQuerySchema,
  newsfeedPostsListResponseSchema,
} from "../../../../../server/marketing-newsfeed/marketing-newsfeed.schemas";
import {
  listMarketingNewsfeedMetadata,
  mutateMarketingNewsfeedMetadata,
} from "../../../../../server/marketing-newsfeed/marketing-newsfeed.route-metadata";
import {
  createMarketingNewsfeedPost,
  listMarketingNewsfeedPosts,
} from "../../../../../server/marketing-newsfeed/marketing-newsfeed.service";

export const GET = createTenantRoute<
  z.output<typeof newsfeedPostsListQuerySchema>,
  z.output<typeof newsfeedPostsListResponseSchema>
>({
  metadata: listMarketingNewsfeedMetadata,
  input: newsfeedPostsListQuerySchema,
  output: newsfeedPostsListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMarketingNewsfeedPosts(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createNewsfeedPostBodySchema>,
  z.output<typeof newsfeedPostResponseSchema>
>({
  metadata: mutateMarketingNewsfeedMetadata,
  body: createNewsfeedPostBodySchema,
  output: newsfeedPostResponseSchema,
  handler: async ({ tx, ctx, input }) => createMarketingNewsfeedPost(tx, ctx, input),
});
