import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  resourceUsageMetricDetailResponseSchema,
  resourceUsageMetricParamsSchema,
  resourceUsageMetricQuerySchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { getResourceUsageMetricDetail } from "@atlas/domain/reports/resource-usage-roster.service";

export const GET = createTenantRoute<
  z.output<typeof resourceUsageMetricQuerySchema>,
  z.output<typeof resourceUsageMetricDetailResponseSchema>,
  typeof resourceUsageMetricParamsSchema
>({
  metadata: listResourceUsageRosterMetadata,
  input: resourceUsageMetricQuerySchema,
  params: resourceUsageMetricParamsSchema,
  output: resourceUsageMetricDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getResourceUsageMetricDetail(tx, ctx, params.metricKey),
});
