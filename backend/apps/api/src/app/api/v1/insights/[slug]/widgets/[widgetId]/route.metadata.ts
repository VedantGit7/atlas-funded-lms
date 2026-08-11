import type { RouteMetadata } from "@atlas/api/route-metadata";
import { insightDashboardMetadata } from "../../../../../../../server/insights/insights.route-metadata";

export const routeMetadata = {
  GET: insightDashboardMetadata,
} satisfies Record<string, RouteMetadata>;
