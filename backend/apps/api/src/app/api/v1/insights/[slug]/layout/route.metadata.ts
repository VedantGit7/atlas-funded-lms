import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  insightDashboardMetadata,
  insightLayoutMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

export const routeMetadata = {
  GET: insightDashboardMetadata,
  PATCH: insightLayoutMutateMetadata,
} satisfies Record<string, RouteMetadata>;
