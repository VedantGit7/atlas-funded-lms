import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getSuperLiveInsightsCompareMetadata } from "@atlas/domain/reports/super-live-insights-compare.route-metadata";

export const routeMetadata = {
  GET: getSuperLiveInsightsCompareMetadata,
} satisfies Record<string, RouteMetadata>;
