import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listResourceUsageRosterMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";

export const routeMetadata = {
  GET: listResourceUsageRosterMetadata,
} satisfies Record<string, RouteMetadata>;
