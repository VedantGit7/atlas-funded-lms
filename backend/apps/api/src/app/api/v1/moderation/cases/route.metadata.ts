import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  createModerationCaseMetadata,
  listModerationCasesMetadata,
} from "../../../../../server/moderation/moderation.route-metadata";

export const routeMetadata = {
  GET: listModerationCasesMetadata,
  POST: createModerationCaseMetadata,
} satisfies Record<string, RouteMetadata>;

export { createModerationCaseMetadata, listModerationCasesMetadata };
