import type { RouteMetadata } from "@atlas/api/route-metadata";
import { mutateZoomInsightsRosterMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";

export const routeMetadata = {
  POST: mutateZoomInsightsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
