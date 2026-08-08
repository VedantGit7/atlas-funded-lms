import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enrollMemberInCourseByInstructor } from "../../../../../../server/enrollments/enrollments.service";
import {
  courseIdParamsSchema,
  courseManageEnrollmentBodySchema,
  courseManageEnrollmentResponseSchema,
} from "../../../../../../server/courses/schemas";
import { postRouteMetadata } from "./route.metadata";

type CourseManageEnrollmentBody = z.output<typeof courseManageEnrollmentBodySchema>;
type CourseManageEnrollmentResponse = z.output<typeof courseManageEnrollmentResponseSchema>;

export const POST = createTenantRoute<
  CourseManageEnrollmentBody,
  CourseManageEnrollmentResponse,
  typeof courseIdParamsSchema
>({
  metadata: postRouteMetadata,
  params: courseIdParamsSchema,
  body: courseManageEnrollmentBodySchema,
  output: courseManageEnrollmentResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return await enrollMemberInCourseByInstructor(tx, ctx, courseId, input);
  },
});
