import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listSuperLiveInsightsCompareCandidatesMetadata } from "@atlas/domain/reports/super-live-insights-compare.route-metadata";

export const routeMetadata = {
  GET: listSuperLiveInsightsCompareCandidatesMetadata,
} satisfies Record<string, RouteMetadata>;
