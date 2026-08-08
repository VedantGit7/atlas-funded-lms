import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createAppealMetadata } from "../../../../server/moderation/moderation.route-metadata";

export const routeMetadata = {
  POST: createAppealMetadata,
} satisfies Record<string, RouteMetadata>;

export { createAppealMetadata };
