import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createCourseDraft } from "../../../../server/courses/course-authoring.service";
import { listPublishedCourses } from "../../../../server/courses/courses.service";
import {
  courseListQuerySchema,
  courseListResponseSchema,
  createCourseBodySchema,
  createCourseResponseSchema,
  studioCourseListResponseSchema,
} from "../../../../server/courses/schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type CourseListQuery = z.output<typeof courseListQuerySchema>;
type CourseListResponse = z.output<typeof courseListResponseSchema>;
type StudioCourseListResponse = z.output<typeof studioCourseListResponseSchema>;
type CreateCourseBody = z.output<typeof createCourseBodySchema>;
type CreateCourseResponse = z.output<typeof createCourseResponseSchema>;

export const GET = createTenantRoute<
  CourseListQuery,
  CourseListResponse | StudioCourseListResponse
>({
  metadata: getRouteMetadata,
  input: courseListQuerySchema,
  output: z.union([courseListResponseSchema, studioCourseListResponseSchema]),
  handler: async ({ tx, ctx, input }) => await listPublishedCourses(tx, ctx, input),
});

export const POST = createTenantRoute<CreateCourseBody, CreateCourseResponse>({
  metadata: postRouteMetadata,
  body: createCourseBodySchema,
  output: createCourseResponseSchema,
  handler: async ({ tx, ctx, input }) => await createCourseDraft(tx, ctx, input),
});
