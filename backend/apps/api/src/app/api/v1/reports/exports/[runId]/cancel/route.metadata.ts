import type { RouteMetadata } from "@atlas/api/route-metadata";
import { cancelExportRunMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: cancelExportRunMetadata,
} satisfies Record<string, RouteMetadata>;
