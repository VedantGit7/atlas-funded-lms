import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getPublishedCourseModules } from "../../../../../../server/courses/courses.service";
import {
  courseIdParamsSchema,
  courseModulesResponseSchema,
} from "../../../../../../server/courses/schemas";
import { getRouteMetadata } from "./route.metadata";

type CourseModulesResponse = z.output<typeof courseModulesResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  CourseModulesResponse,
  typeof courseIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: courseIdParamsSchema,
  output: courseModulesResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await getPublishedCourseModules(tx, ctx, courseId);
  },
});
