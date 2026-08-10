import type { RouteMetadata } from "@atlas/api/route-metadata";
import { bulkMutateSchedulesMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: bulkMutateSchedulesMetadata,
} satisfies Record<string, RouteMetadata>;
