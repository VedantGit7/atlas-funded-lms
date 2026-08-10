import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  listResourceUsageRosterMetadata,
  mutateResourceUsageDormantMetadata,
} from "@atlas/domain/reports/resource-usage-roster.route-metadata";

export const routeMetadata = {
  GET: listResourceUsageRosterMetadata,
  POST: mutateResourceUsageDormantMetadata,
} satisfies Record<string, RouteMetadata>;
