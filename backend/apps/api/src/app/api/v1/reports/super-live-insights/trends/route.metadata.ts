import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getSuperLiveInsightsTrendsMetadata } from "@atlas/domain/reports/super-live-insights-trends.route-metadata";

export const routeMetadata = {
  GET: getSuperLiveInsightsTrendsMetadata,
} satisfies Record<string, RouteMetadata>;
