import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getScheduleDetailMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  GET: getScheduleDetailMetadata,
} satisfies Record<string, RouteMetadata>;
