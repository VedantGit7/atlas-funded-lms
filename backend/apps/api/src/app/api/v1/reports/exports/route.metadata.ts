import type { RouteMetadata } from "@atlas/api/route-metadata";
import { listExportsRosterMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  GET: listExportsRosterMetadata,
} satisfies Record<string, RouteMetadata>;
