import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  listZoomInsightsRosterMetadata,
  mutateZoomInsightsRosterMetadata,
} from "@atlas/domain/reports/zoom-insights-roster.route-metadata";

export const routeMetadata = {
  GET: listZoomInsightsRosterMetadata,
  PATCH: mutateZoomInsightsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
