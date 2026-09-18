import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  commentDetailResponseSchema,
  commentListResponseSchema,
  createCommentBodySchema,
} from "../../../../../../server/community/community.dto";
import {
  createLessonComment,
  listLessonComments,
} from "../../../../../../server/lessons/lesson-discussion.service";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { createLessonCommentMetadata, listLessonCommentsMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof commentListResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: listLessonCommentsMetadata,
  params: uuidParamSchema,
  output: commentListResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await listLessonComments(tx, ctx, lessonId);
  },
});

export const POST = createTenantRoute<
  z.output<typeof createCommentBodySchema>,
  z.output<typeof commentDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: createLessonCommentMetadata,
  params: uuidParamSchema,
  body: createCommentBodySchema,
  output: commentDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await createLessonComment(tx, ctx, lessonId, input);
  },
});
