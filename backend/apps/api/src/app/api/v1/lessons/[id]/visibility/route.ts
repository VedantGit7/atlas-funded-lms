import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  contentVisibilityBodySchema,
  contentVisibilityResponseSchema,
} from "../../../../../../server/courses/course-authoring-schemas";
import { setLessonVisibility } from "../../../../../../server/courses/course-visibility.service";
import { putRouteMetadata } from "./route.metadata";

export const PUT = createTenantRoute<
  z.output<typeof contentVisibilityBodySchema>,
  z.output<typeof contentVisibilityResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: contentVisibilityBodySchema,
  output: contentVisibilityResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const lessonId = params["id"];
    if (!lessonId) throw new Error("Missing lesson id");
    return await setLessonVisibility(tx, ctx, lessonId, input);
  },
});
