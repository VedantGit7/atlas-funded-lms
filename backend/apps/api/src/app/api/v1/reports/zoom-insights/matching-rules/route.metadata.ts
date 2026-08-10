import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  listZoomInsightsRosterMetadata,
  updateZoomMatchingRulesMetadata,
} from "@atlas/domain/reports/zoom-insights-roster.route-metadata";

export const routeMetadata = {
  GET: listZoomInsightsRosterMetadata,
  PATCH: updateZoomMatchingRulesMetadata,
} satisfies Record<string, RouteMetadata>;
