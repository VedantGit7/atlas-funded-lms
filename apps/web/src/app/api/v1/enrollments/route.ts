import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enrollCurrentMemberInCourse } from "../../../../server/enrollments/enrollments.service";
import {
  enrollmentCreateBodySchema,
  enrollmentResponseSchema,
} from "../../../../server/enrollments/schemas";
import { postRouteMetadata } from "./route.metadata";

type EnrollmentBody = z.output<typeof enrollmentCreateBodySchema>;
type EnrollmentResponse = z.output<typeof enrollmentResponseSchema>;

export const POST = createTenantRoute<EnrollmentBody, EnrollmentResponse>({
  metadata: postRouteMetadata,
  body: enrollmentCreateBodySchema,
  output: enrollmentResponseSchema,
  handler: async ({ tx, ctx, input }) => await enrollCurrentMemberInCourse(tx, ctx, input),
});
