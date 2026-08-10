import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  listResourceUsageRosterMetadata,
  mutateResourceUsageInactiveMetadata,
} from "@atlas/domain/reports/resource-usage-roster.route-metadata";

export const routeMetadata = {
  GET: listResourceUsageRosterMetadata,
  POST: mutateResourceUsageInactiveMetadata,
} satisfies Record<string, RouteMetadata>;
