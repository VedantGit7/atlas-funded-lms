import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listReportDefinitionsMetadata } from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  GET: listReportDefinitionsMetadata,
} satisfies Record<string, RouteMetadata>;

export { listReportDefinitionsMetadata };
