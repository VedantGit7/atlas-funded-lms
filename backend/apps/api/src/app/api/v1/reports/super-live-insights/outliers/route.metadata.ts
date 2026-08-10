import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getSuperLiveInsightsOutliersMetadata } from "@atlas/domain/reports/super-live-insights-outliers.route-metadata";

export const routeMetadata = {
  GET: getSuperLiveInsightsOutliersMetadata,
} satisfies Record<string, RouteMetadata>;
