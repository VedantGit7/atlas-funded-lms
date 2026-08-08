import type { RouteMetadata } from "@atlas/api/route-metadata";
import { getMyDeletionRequestStatusMetadata } from "@atlas/domain/data-rights/data-rights.route-metadata";

export const routeMetadata = getMyDeletionRequestStatusMetadata satisfies RouteMetadata;

export { getMyDeletionRequestStatusMetadata };
