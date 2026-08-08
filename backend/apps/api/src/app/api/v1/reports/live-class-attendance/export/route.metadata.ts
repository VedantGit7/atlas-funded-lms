import type { RouteMetadata } from "@atlas/api/route-metadata";
import { exportLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";

export const routeMetadata = {
  POST: exportLiveClassAttendanceRosterMetadata,
} satisfies Record<string, RouteMetadata>;
