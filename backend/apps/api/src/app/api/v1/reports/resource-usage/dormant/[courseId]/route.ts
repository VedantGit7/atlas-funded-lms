import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageDormantCourseDetailResponseSchema,
  resourceUsageDormantCourseParamsSchema,
  resourceUsageDormantCourseQuerySchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { getResourceUsageDormantCourseDetail } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageDormantCourseQuerySchema>,
  z.output<typeof resourceUsageDormantCourseDetailResponseSchema>,
  typeof resourceUsageDormantCourseParamsSchema
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageDormantCourseQuerySchema,
  params: resourceUsageDormantCourseParamsSchema,
  output: resourceUsageDormantCourseDetailResponseSchema,
  handler: async ({ tx, ctx, input, params }) =>
    getResourceUsageDormantCourseDetail(tx, ctx, params.courseId, input),
});
