import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  lessonQuizResponseSchema,
  putLessonQuizBodySchema,
  type LessonQuizResponse,
  type PutLessonQuizBody,
} from "../../../../../../server/lessons/lesson-quiz.schemas";
import { getLessonQuiz, putLessonQuiz } from "../../../../../../server/lessons/lesson-quiz.service";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  LessonQuizResponse,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: lessonQuizResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await getLessonQuiz(tx, ctx, lessonId);
  },
});

export const PUT = createTenantRoute<PutLessonQuizBody, LessonQuizResponse, typeof uuidParamSchema>(
  {
    metadata: putRouteMetadata,
    params: uuidParamSchema,
    body: putLessonQuizBodySchema,
    output: lessonQuizResponseSchema,
    handler: async ({ tx, ctx, params, input }) => {
      const lessonId = params["id"];
      if (!lessonId) throw new Error("Missing lesson id");
      return await putLessonQuiz(tx, ctx, lessonId, input);
    },
  },
);
