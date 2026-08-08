import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  enrollCurrentMemberInCourse,
  listEnrollments,
} from "../../../../server/enrollments/enrollments.service";
import {
  enrollmentCreateBodySchema,
  enrollmentListQuerySchema,
  enrollmentListResponseSchema,
  enrollmentResponseSchema,
} from "../../../../server/enrollments/schemas";
import { getEnrollmentsRouteMetadata, postRouteMetadata } from "./route.metadata";

type EnrollmentBody = z.output<typeof enrollmentCreateBodySchema>;
type EnrollmentResponse = z.output<typeof enrollmentResponseSchema>;
type EnrollmentListQuery = z.output<typeof enrollmentListQuerySchema>;
type EnrollmentListResponse = z.output<typeof enrollmentListResponseSchema>;

export const GET = createTenantRoute<EnrollmentListQuery, EnrollmentListResponse>({
  metadata: getEnrollmentsRouteMetadata,
  input: enrollmentListQuerySchema,
  output: enrollmentListResponseSchema,
  handler: async ({ tx, ctx, input }) => await listEnrollments(tx, ctx, input),
});

export const POST = createTenantRoute<EnrollmentBody, EnrollmentResponse>({
  metadata: postRouteMetadata,
  body: enrollmentCreateBodySchema,
  output: enrollmentResponseSchema,
  handler: async ({ tx, ctx, input }) => await enrollCurrentMemberInCourse(tx, ctx, input),
});
