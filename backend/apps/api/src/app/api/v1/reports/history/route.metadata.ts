import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listReportRunsMetadata } from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  GET: listReportRunsMetadata,
} satisfies Record<string, RouteMetadata>;

export { listReportRunsMetadata };
