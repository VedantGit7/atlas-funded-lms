import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getPublishedCourseDetail } from "../../../../../server/courses/courses.service";
import {
  courseDetailResponseSchema,
  courseIdParamsSchema,
} from "../../../../../server/courses/schemas";
import { getRouteMetadata } from "./route.metadata";

type CourseDetailResponse = z.output<typeof courseDetailResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  CourseDetailResponse,
  typeof courseIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: courseIdParamsSchema,
  output: courseDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await getPublishedCourseDetail(tx, ctx, courseId);
  },
});
