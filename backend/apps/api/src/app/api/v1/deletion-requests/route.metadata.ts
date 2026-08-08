import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  createDeletionRequestMetadata,
  listDeletionRequestsMetadata,
} from "@atlas/domain/data-rights/data-rights.route-metadata";

export const routeMetadata = {
  GET: listDeletionRequestsMetadata,
  POST: createDeletionRequestMetadata,
} satisfies Record<string, RouteMetadata>;

export { createDeletionRequestMetadata, listDeletionRequestsMetadata };
