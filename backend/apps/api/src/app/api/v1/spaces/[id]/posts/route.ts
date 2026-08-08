import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createPostBodySchema,
  postListResponseSchema,
  postDetailResponseSchema,
  spaceIdParamsSchema,
} from "../../../../../../server/community/community.dto";
import { createPost, listPostsInSpace } from "../../../../../../server/community/community.service";
import {
  createSpacePostMetadata,
  listSpacePostsMetadata,
} from "../../../../../../server/community/community.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof postListResponseSchema>,
  typeof spaceIdParamsSchema
>({
  metadata: listSpacePostsMetadata,
  params: spaceIdParamsSchema,
  output: postListResponseSchema,
  handler: async ({ tx, ctx, params }) => listPostsInSpace(tx, ctx, params["id"] ?? ""),
});

export const POST = createTenantRoute<
  z.output<typeof createPostBodySchema>,
  z.output<typeof postDetailResponseSchema>,
  typeof spaceIdParamsSchema
>({
  metadata: createSpacePostMetadata,
  params: spaceIdParamsSchema,
  body: createPostBodySchema,
  output: postDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => createPost(tx, ctx, params["id"] ?? "", input),
});
