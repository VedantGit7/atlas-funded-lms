import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { courseIdParamsSchema } from "../../../../../../server/courses/schemas";
import { listCourseProgress } from "../../../../../../server/courses/course-progress.service";
import {
  courseProgressListQuerySchema,
  courseProgressListResponseSchema,
} from "../../../../../../server/courses/course-progress.schemas";
import { getCourseProgressRouteMetadata } from "./route.metadata";

type CourseProgressListQuery = z.output<typeof courseProgressListQuerySchema>;
type CourseProgressListResponse = z.output<typeof courseProgressListResponseSchema>;

export const GET = createTenantRoute<CourseProgressListQuery, CourseProgressListResponse>({
  metadata: getCourseProgressRouteMetadata,
  params: courseIdParamsSchema,
  input: courseProgressListQuerySchema,
  output: courseProgressListResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const { id } = courseIdParamsSchema.parse(params);
    return await listCourseProgress(tx, ctx, id, input);
  },
});
