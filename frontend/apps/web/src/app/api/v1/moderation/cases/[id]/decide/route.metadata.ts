import type { RouteMetadata } from "@atlas/api/route-metadata";
import { decideModerationCaseMetadata } from "../../../../../../../server/moderation/moderation.route-metadata";

export const routeMetadata = {
  POST: decideModerationCaseMetadata,
} satisfies Record<string, RouteMetadata>;

export { decideModerationCaseMetadata };
