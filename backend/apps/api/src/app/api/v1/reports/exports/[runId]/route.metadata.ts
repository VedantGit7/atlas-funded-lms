import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getExportRunDetailMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  GET: getExportRunDetailMetadata,
} satisfies Record<string, RouteMetadata>;
