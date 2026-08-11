import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  insightDashboardMetadata,
  insightDigestsMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

export const routeMetadata = {
  GET: insightDashboardMetadata,
  PATCH: insightDigestsMutateMetadata,
} satisfies Record<string, RouteMetadata>;
