import type { RouteMetadata } from "@atlas/api/route-metadata";
import { runScheduleNowMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: runScheduleNowMetadata,
} satisfies Record<string, RouteMetadata>;
