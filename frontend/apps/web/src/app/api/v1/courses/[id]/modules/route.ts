import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createCourseModule } from "../../../../../../server/courses/course-authoring.service";
import { getPublishedCourseModules } from "../../../../../../server/courses/courses.service";
import {
  courseDetailQuerySchema,
  courseIdParamsSchema,
  courseModulesResponseSchema,
  createModuleBodySchema,
  studioCourseModulesResponseSchema,
  studioModuleResponseSchema,
} from "../../../../../../server/courses/schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type CourseDetailQuery = z.output<typeof courseDetailQuerySchema>;
type CourseModulesResponse = z.output<typeof courseModulesResponseSchema>;
type StudioCourseModulesResponse = z.output<typeof studioCourseModulesResponseSchema>;
type CreateModuleBody = z.output<typeof createModuleBodySchema>;
type StudioModuleResponse = z.output<typeof studioModuleResponseSchema>;

export const GET = createTenantRoute<
  CourseDetailQuery,
  CourseModulesResponse | StudioCourseModulesResponse,
  typeof courseIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: courseIdParamsSchema,
  input: courseDetailQuerySchema,
  output: z.union([courseModulesResponseSchema, studioCourseModulesResponseSchema]),
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await getPublishedCourseModules(tx, ctx, courseId, input);
  },
});

export const POST = createTenantRoute<
  CreateModuleBody,
  StudioModuleResponse,
  typeof courseIdParamsSchema
>({
  metadata: postRouteMetadata,
  params: courseIdParamsSchema,
  body: createModuleBodySchema,
  output: studioModuleResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await createCourseModule(tx, ctx, courseId, input);
  },
});
