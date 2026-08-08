import type { RouteMetadata } from "@atlas/api/route-metadata";
import { exportZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";

export const routeMetadata = {
  POST: exportZoomInsightsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
