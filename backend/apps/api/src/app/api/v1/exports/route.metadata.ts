import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  createExportMetadata,
  listExportsMetadata,
} from "@atlas/domain/data-rights/data-rights.route-metadata";

export const routeMetadata = {
  GET: listExportsMetadata,
  POST: createExportMetadata,
} satisfies Record<string, RouteMetadata>;

export { createExportMetadata, listExportsMetadata };
