import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listSuperLiveInsightsRosterMetadata } from "@atlas/domain/reports/super-live-insights-roster.route-metadata";

export const routeMetadata = {
  GET: listSuperLiveInsightsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
