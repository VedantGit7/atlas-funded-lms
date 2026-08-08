import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  createLesson,
  listLessonsForModule,
} from "../../../../../../server/lessons/lessons.service";
import {
  createLessonBodySchema,
  learnerLessonsResponseSchema,
  lessonDetailQuerySchema,
  studioLessonResponseSchema,
  studioLessonsResponseSchema,
} from "../../../../../../server/lessons/lesson-schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type LessonDetailQuery = z.output<typeof lessonDetailQuerySchema>;
type CreateLessonBody = z.output<typeof createLessonBodySchema>;

export const GET = createTenantRoute<
  LessonDetailQuery,
  z.output<typeof learnerLessonsResponseSchema> | z.output<typeof studioLessonsResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: lessonDetailQuerySchema,
  // Studio schema must be first: learner is a subset and would strip lessonType/status.
  output: z.union([studioLessonsResponseSchema, learnerLessonsResponseSchema]),
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await listLessonsForModule(tx, ctx, moduleId, input);
  },
});

export const POST = createTenantRoute<
  CreateLessonBody,
  z.output<typeof studioLessonResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: createLessonBodySchema,
  output: studioLessonResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await createLesson(tx, ctx, moduleId, input);
  },
});
