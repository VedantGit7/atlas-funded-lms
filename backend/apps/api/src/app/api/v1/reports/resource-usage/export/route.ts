import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportResourceUsageRosterBodySchema,
  exportResourceUsageRosterResponseSchema,
} from "@atlas/domain/reports/resource-usage-roster.dto";
import { exportResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";
import { exportResourceUsageRoster } from "../../../../../../../server/reports/resource-usage-roster-actions.service";

export const POST = createTenantRoute<
  z.output<typeof exportResourceUsageRosterBodySchema>,
  z.output<typeof exportResourceUsageRosterResponseSchema>
>({
  metadata: exportResourceUsageRosterMetadata,
  body: exportResourceUsageRosterBodySchema,
  output: exportResourceUsageRosterResponseSchema,
  handler: async ({ tx, ctx, input }) => exportResourceUsageRoster(tx, ctx, input),
});
