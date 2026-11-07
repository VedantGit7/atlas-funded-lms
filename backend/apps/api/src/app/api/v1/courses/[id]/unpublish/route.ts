import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  courseUnpublishBodySchema,
  courseUnpublishPreviewResponseSchema,
  courseUnpublishResponseSchema,
} from "../../../../../../server/courses/course-authoring-schemas";
import {
  previewCourseUnpublish,
  unpublishCourse,
} from "../../../../../../server/courses/course-visibility.service";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof courseUnpublishPreviewResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: courseUnpublishPreviewResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await previewCourseUnpublish(tx, ctx, courseId);
  },
});

export const POST = createTenantRoute<
  z.output<typeof courseUnpublishBodySchema>,
  z.output<typeof courseUnpublishResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: courseUnpublishBodySchema,
  output: courseUnpublishResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await unpublishCourse(tx, ctx, courseId, input);
  },
});
