import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { recordLessonProgress } from "../../../../../../server/lessons/lesson-progress.service";
import {
  lessonProgressBodySchema,
  lessonProgressResponseSchema,
} from "../../../../../../server/lessons/lesson-schemas";
import { postRouteMetadata } from "./route.metadata";

type LessonProgressBody = z.output<typeof lessonProgressBodySchema>;

export const POST = createTenantRoute<
  LessonProgressBody,
  z.output<typeof lessonProgressResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: lessonProgressBodySchema,
  output: lessonProgressResponseSchema,
  handler: async ({ tx, ctx, params, input, resource }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await recordLessonProgress(tx, ctx, lessonId, input, resource);
  },
});
