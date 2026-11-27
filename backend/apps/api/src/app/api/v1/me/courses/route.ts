import { createTenantRoute } from "@atlas/api";
import {
  myCoursesResponseSchema,
  type MyCoursesResponse,
} from "../../../../../server/enrollments/my-courses.schemas";
import { listMyCourses } from "../../../../../server/enrollments/my-courses.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute<Record<string, never>, MyCoursesResponse>({
  metadata: routeMetadata,
  output: myCoursesResponseSchema,
  handler: async ({ tx, ctx }) => listMyCourses(tx, ctx),
});
