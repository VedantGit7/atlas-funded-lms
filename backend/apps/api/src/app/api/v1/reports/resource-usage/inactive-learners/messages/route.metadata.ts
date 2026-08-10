import type { RouteMetadata } from "@atlas/api/route-metadata";
import { messageResourceUsageInactiveMetadata } from "@atlas/domain/reports/resource-usage-roster.route-metadata";

export const routeMetadata = {
  POST: messageResourceUsageInactiveMetadata,
} satisfies Record<string, RouteMetadata>;
