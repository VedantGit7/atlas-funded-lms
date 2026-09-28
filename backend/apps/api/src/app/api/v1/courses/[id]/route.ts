import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  archiveOrDeleteCourse,
  updateCourse,
} from "../../../../../server/courses/course-authoring.service";
import { getPublishedCourseDetail } from "../../../../../server/courses/courses.service";
import {
  archiveCourseResponseSchema,
  courseDetailQuerySchema,
  courseDetailResponseSchema,
  courseIdParamsSchema,
  studioCourseDetailResponseSchema,
  updateCourseBodySchema,
} from "../../../../../server/courses/schemas";
import { deleteRouteMetadata, getRouteMetadata, putRouteMetadata } from "./route.metadata";

type CourseDetailResponse = z.output<typeof courseDetailResponseSchema>;
type StudioCourseDetailResponse = z.output<typeof studioCourseDetailResponseSchema>;
type CourseDetailQuery = z.output<typeof courseDetailQuerySchema>;
type UpdateCourseBody = z.output<typeof updateCourseBodySchema>;
type ArchiveCourseResponse = z.output<typeof archiveCourseResponseSchema>;

export const GET = createTenantRoute<
  CourseDetailQuery,
  CourseDetailResponse | StudioCourseDetailResponse,
  typeof courseIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: courseIdParamsSchema,
  input: courseDetailQuerySchema,
  output: z.union([courseDetailResponseSchema, studioCourseDetailResponseSchema]),
  handler: async ({ tx, ctx, params, input, resource }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await getPublishedCourseDetail(tx, ctx, courseId, input, resource);
  },
});

export const PUT = createTenantRoute<
  UpdateCourseBody,
  StudioCourseDetailResponse,
  typeof courseIdParamsSchema
>({
  metadata: putRouteMetadata,
  params: courseIdParamsSchema,
  body: updateCourseBodySchema,
  output: studioCourseDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await updateCourse(tx, ctx, courseId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  ArchiveCourseResponse,
  typeof courseIdParamsSchema
>({
  metadata: deleteRouteMetadata,
  params: courseIdParamsSchema,
  output: archiveCourseResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await archiveOrDeleteCourse(tx, ctx, courseId);
  },
});
