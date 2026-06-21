import type { RouteMetadata } from "@atlas/api/route-metadata";
import { deletePostMetadata } from "../../../../../server/community/community.route-metadata";

export const routeMetadata = {
  DELETE: deletePostMetadata,
} satisfies Record<string, RouteMetadata>;

export { deletePostMetadata };
