import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deletePostResponseSchema,
  postIdParamsSchema,
} from "../../../../../server/community/community.dto";
import { deletePost } from "../../../../../server/community/community.service";
import { deletePostMetadata } from "../../../../../server/community/community.route-metadata";

type DeletePostResponse = z.output<typeof deletePostResponseSchema>;

export const DELETE = createTenantRoute<
  Record<string, never>,
  DeletePostResponse,
  typeof postIdParamsSchema
>({
  metadata: deletePostMetadata,
  params: postIdParamsSchema,
  output: deletePostResponseSchema,
  handler: async ({ tx, ctx, params }) => deletePost(tx, ctx, params["id"] ?? ""),
});
