import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  createReportScheduleMetadata,
  listReportSchedulesMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  GET: listReportSchedulesMetadata,
  POST: createReportScheduleMetadata,
} satisfies Record<string, RouteMetadata>;

export { createReportScheduleMetadata, listReportSchedulesMetadata };
