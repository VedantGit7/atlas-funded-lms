import type { RouteMetadata } from "@atlas/api/route-metadata";
import { previewSuperLiveInsightsOutliersMetadata } from "@atlas/domain/reports/super-live-insights-outliers.route-metadata";

export const routeMetadata = {
  GET: previewSuperLiveInsightsOutliersMetadata,
} satisfies Record<string, RouteMetadata>;
