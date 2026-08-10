import type { RouteMetadata } from "@atlas/api/route-metadata";
import { previewExportBuilderMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: previewExportBuilderMetadata,
} satisfies Record<string, RouteMetadata>;
