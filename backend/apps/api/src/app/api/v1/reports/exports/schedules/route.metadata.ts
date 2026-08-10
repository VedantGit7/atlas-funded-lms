import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listSchedulesRosterMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  GET: listSchedulesRosterMetadata,
} satisfies Record<string, RouteMetadata>;
