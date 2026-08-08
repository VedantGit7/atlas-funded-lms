import type { RouteMetadata } from "@atlas/api/route-metadata";
import { reviewAppealMetadata } from "../../../../../../server/moderation/moderation.route-metadata";

export const routeMetadata = {
  POST: reviewAppealMetadata,
} satisfies Record<string, RouteMetadata>;

export { reviewAppealMetadata };
