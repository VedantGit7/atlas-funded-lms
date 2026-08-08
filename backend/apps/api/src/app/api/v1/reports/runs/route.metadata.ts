import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  createReportRunMetadata,
  listReportRunsMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  GET: listReportRunsMetadata,
  POST: createReportRunMetadata,
} satisfies Record<string, RouteMetadata>;

export { createReportRunMetadata, listReportRunsMetadata };
