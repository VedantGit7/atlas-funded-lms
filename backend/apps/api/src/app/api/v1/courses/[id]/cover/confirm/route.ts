import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { confirmCourseCoverService } from "../../../../../../../server/courses/course-cover.service";
import {
  courseCoverConfirmBodySchema,
  courseCoverConfirmResponseSchema,
} from "../../../../../../../server/courses/course-cover.schemas";
import { postCoverRouteMetadata } from "../upload/route.metadata";

type CourseCoverConfirmBody = z.output<typeof courseCoverConfirmBodySchema>;

/** Checks the uploaded image and makes it the course's image. */
export const POST = createTenantRoute<
  CourseCoverConfirmBody,
  z.output<typeof courseCoverConfirmResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postCoverRouteMetadata,
  params: uuidParamSchema,
  body: courseCoverConfirmBodySchema,
  output: courseCoverConfirmResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await confirmCourseCoverService(tx, ctx, courseId, input);
  },
});
