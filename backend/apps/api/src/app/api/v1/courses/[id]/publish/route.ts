import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { submitCourseForReview } from "../../../../../../server/courses/course-authoring.service";
import {
  courseIdParamsSchema,
  publishCourseBodySchema,
  publishCourseResponseSchema,
} from "../../../../../../server/courses/schemas";
import { publishRouteMetadata } from "./route.metadata";

type PublishCourseBody = z.output<typeof publishCourseBodySchema>;
type PublishCourseResponse = z.output<typeof publishCourseResponseSchema>;

export const POST = createTenantRoute<
  PublishCourseBody,
  PublishCourseResponse,
  typeof courseIdParamsSchema
>({
  metadata: publishRouteMetadata,
  params: courseIdParamsSchema,
  body: publishCourseBodySchema,
  output: publishCourseResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await submitCourseForReview(tx, ctx, courseId, input);
  },
});
