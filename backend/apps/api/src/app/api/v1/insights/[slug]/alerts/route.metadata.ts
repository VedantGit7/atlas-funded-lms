import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  insightAlertsMutateMetadata,
  insightDashboardMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

export const routeMetadata = {
  GET: insightDashboardMetadata,
  PATCH: insightAlertsMutateMetadata,
} satisfies Record<string, RouteMetadata>;
