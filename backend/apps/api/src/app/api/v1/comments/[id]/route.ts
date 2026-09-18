import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  commentDetailResponseSchema,
  commentIdParamsSchema,
  deleteCommentResponseSchema,
  updateCommentBodySchema,
} from "../../../../../server/community/community.dto";
import { deleteComment, updateComment } from "../../../../../server/community/community.service";
import {
  deleteCommentMetadata,
  updateCommentMetadata,
} from "../../../../../server/community/community.route-metadata";

export const PUT = createTenantRoute<
  z.output<typeof updateCommentBodySchema>,
  z.output<typeof commentDetailResponseSchema>,
  typeof commentIdParamsSchema
>({
  metadata: updateCommentMetadata,
  params: commentIdParamsSchema,
  body: updateCommentBodySchema,
  output: commentDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateComment(tx, ctx, params.id, input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteCommentResponseSchema>,
  typeof commentIdParamsSchema
>({
  metadata: deleteCommentMetadata,
  params: commentIdParamsSchema,
  output: deleteCommentResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteComment(tx, ctx, params.id),
});
