import type { RouteMetadata } from "@atlas/api/route-metadata";
import { mutateZoomConnectionMetadata } from "@atlas/domain/reports/zoom-insights-roster.route-metadata";

export const routeMetadata = {
  POST: mutateZoomConnectionMetadata,
} satisfies Record<string, RouteMetadata>;
