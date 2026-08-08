import type { RouteMetadata } from "@atlas/api/route-metadata";
import { exportExportsRosterMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: exportExportsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
