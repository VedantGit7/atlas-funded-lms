import type { RouteMetadata } from "@atlas/api/route-metadata";
import { duplicateScheduleMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: duplicateScheduleMetadata,
} satisfies Record<string, RouteMetadata>;
