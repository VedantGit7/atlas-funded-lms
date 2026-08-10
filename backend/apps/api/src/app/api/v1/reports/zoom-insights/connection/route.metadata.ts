import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";

export const routeMetadata = {
  GET: listZoomInsightsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
