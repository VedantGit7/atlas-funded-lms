import type { RouteMetadata } from "@atlas/api/route-metadata";
import { exportResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";

export const routeMetadata = {
  POST: exportResourceUsageRosterMetadata,
} satisfies Record<string, RouteMetadata>;
