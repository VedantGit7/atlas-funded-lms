import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  createCustomReportDefinitionMetadata,
  listReportDefinitionsMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  GET: listReportDefinitionsMetadata,
  POST: createCustomReportDefinitionMetadata,
} satisfies Record<string, RouteMetadata>;

export { createCustomReportDefinitionMetadata, listReportDefinitionsMetadata };
