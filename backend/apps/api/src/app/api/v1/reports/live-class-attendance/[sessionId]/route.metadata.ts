import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";

export const routeMetadata = {
  GET: listLiveClassAttendanceRosterMetadata,
} satisfies Record<string, RouteMetadata>;
