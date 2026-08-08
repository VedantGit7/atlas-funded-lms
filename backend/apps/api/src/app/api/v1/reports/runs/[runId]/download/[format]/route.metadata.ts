import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getReportRunMetadata } from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  GET: getReportRunMetadata,
} satisfies Record<string, RouteMetadata>;

export { getReportRunMetadata };
