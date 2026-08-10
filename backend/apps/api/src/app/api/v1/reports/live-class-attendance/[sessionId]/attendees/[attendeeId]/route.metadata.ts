import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  listLiveClassAttendanceRosterMetadata,
  mutateLiveClassAttendanceRosterMetadata,
} from "@atlas/domain/reports/live-class-attendance-roster.route-metadata";

export const routeMetadata = {
  GET: listLiveClassAttendanceRosterMetadata,
  PATCH: mutateLiveClassAttendanceRosterMetadata,
} satisfies Record<string, RouteMetadata>;
