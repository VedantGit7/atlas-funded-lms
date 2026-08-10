import type { RouteMetadata } from "@atlas/api/route-metadata";
import { retryExportRunMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: retryExportRunMetadata,
} satisfies Record<string, RouteMetadata>;
