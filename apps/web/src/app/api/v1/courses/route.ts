import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listPublishedCourses } from "../../../../server/courses/courses.service";
import {
  courseListQuerySchema,
  courseListResponseSchema,
} from "../../../../server/courses/schemas";
import { getRouteMetadata } from "./route.metadata";

type CourseListQuery = z.output<typeof courseListQuerySchema>;
type CourseListResponse = z.output<typeof courseListResponseSchema>;

export const GET = createTenantRoute<CourseListQuery, CourseListResponse>({
  metadata: getRouteMetadata,
  input: courseListQuerySchema,
  output: courseListResponseSchema,
  handler: async ({ tx, ctx, input }) => await listPublishedCourses(tx, ctx, input),
});
