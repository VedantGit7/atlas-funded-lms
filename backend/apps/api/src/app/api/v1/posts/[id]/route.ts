import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deletePostResponseSchema,
  postDetailResponseSchema,
  postIdParamsSchema,
} from "../../../../../server/community/community.dto";
import { deletePost, getPostById } from "../../../../../server/community/community.service";
import {
  deletePostMetadata,
  getPostMetadata,
} from "../../../../../server/community/community.route-metadata";

type PostDetailResponse = z.output<typeof postDetailResponseSchema>;
type DeletePostResponse = z.output<typeof deletePostResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  PostDetailResponse,
  typeof postIdParamsSchema
>({
  metadata: getPostMetadata,
  params: postIdParamsSchema,
  output: postDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getPostById(tx, ctx, params.id),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  DeletePostResponse,
  typeof postIdParamsSchema
>({
  metadata: deletePostMetadata,
  params: postIdParamsSchema,
  output: deletePostResponseSchema,
  handler: async ({ tx, ctx, params }) => deletePost(tx, ctx, params.id),
});
