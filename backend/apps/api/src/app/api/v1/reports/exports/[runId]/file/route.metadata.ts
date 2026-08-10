import type { RouteMetadata } from "@atlas/api/route-metadata";
import { deleteExportRunFileMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: deleteExportRunFileMetadata,
} satisfies Record<string, RouteMetadata>;
