import type { RouteMetadata } from "@atlas/api/route-metadata";
import { messageLiveClassAttendanceRosterMetadata } from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";

export const routeMetadata = {
  POST: messageLiveClassAttendanceRosterMetadata,
} satisfies Record<string, RouteMetadata>;
