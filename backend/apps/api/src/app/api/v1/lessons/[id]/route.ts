import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  archiveOrDeleteLesson,
  getLesson,
  updateLesson,
} from "../../../../../server/lessons/lessons.service";
import {
  deleteLessonResponseSchema,
  learnerLessonDetailResponseSchema,
  lessonDetailQuerySchema,
  studioLessonDetailResponseSchema,
  updateLessonBodySchema,
} from "../../../../../server/lessons/lesson-schemas";
import { deleteRouteMetadata, getRouteMetadata, putRouteMetadata } from "./route.metadata";

type LessonDetailQuery = z.output<typeof lessonDetailQuerySchema>;
type UpdateLessonBody = z.output<typeof updateLessonBodySchema>;

export const GET = createTenantRoute<
  LessonDetailQuery,
  | z.output<typeof learnerLessonDetailResponseSchema>
  | z.output<typeof studioLessonDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: lessonDetailQuerySchema,
  // Studio schema must be first so studio-only fields are not stripped.
  output: z.union([studioLessonDetailResponseSchema, learnerLessonDetailResponseSchema]),
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await getLesson(tx, ctx, lessonId, input);
  },
});

export const PUT = createTenantRoute<
  UpdateLessonBody,
  z.output<typeof studioLessonDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: updateLessonBodySchema,
  output: studioLessonDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await updateLesson(tx, ctx, lessonId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteLessonResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  output: deleteLessonResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await archiveOrDeleteLesson(tx, ctx, lessonId);
  },
});
