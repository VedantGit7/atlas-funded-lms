import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  deleteReportScheduleMetadata,
  updateReportScheduleMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const routeMetadata = {
  PATCH: updateReportScheduleMetadata,
  DELETE: deleteReportScheduleMetadata,
} satisfies Record<string, RouteMetadata>;

export { deleteReportScheduleMetadata, updateReportScheduleMetadata };
