import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  commentListResponseSchema,
  commentDetailResponseSchema,
  createCommentBodySchema,
  postIdParamsSchema,
} from "../../../../../../server/community/community.dto";
import {
  createComment,
  listCommentsForPost,
} from "../../../../../../server/community/community.service";
import {
  createPostCommentMetadata,
  listPostCommentsMetadata,
} from "../../../../../../server/community/community.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof commentListResponseSchema>,
  typeof postIdParamsSchema
>({
  metadata: listPostCommentsMetadata,
  params: postIdParamsSchema,
  output: commentListResponseSchema,
  handler: async ({ tx, ctx, params }) => listCommentsForPost(tx, ctx, params["id"] ?? ""),
});

export const POST = createTenantRoute<
  z.output<typeof createCommentBodySchema>,
  z.output<typeof commentDetailResponseSchema>,
  typeof postIdParamsSchema
>({
  metadata: createPostCommentMetadata,
  params: postIdParamsSchema,
  body: createCommentBodySchema,
  output: commentDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => createComment(tx, ctx, params["id"] ?? "", input),
});
