import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  insightDashboardMetadata,
  insightSettingsMutateMetadata,
} from "../../../../../../server/insights/insights.route-metadata";

export const routeMetadata = {
  GET: insightDashboardMetadata,
  PATCH: insightSettingsMutateMetadata,
} satisfies Record<string, RouteMetadata>;
