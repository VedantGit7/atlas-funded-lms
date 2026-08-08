import type { RouteMetadata } from "@atlas/api/route-metadata";
import { exportSuperLiveInsightsRosterMetadata } from "@atlas/domain/reports/super-live-insights-roster.route-metadata";

export const routeMetadata = {
  POST: exportSuperLiveInsightsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
