import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  deletePostMetadata,
  getPostMetadata,
} from "../../../../../server/community/community.route-metadata";

export const routeMetadata = {
  GET: getPostMetadata,
  DELETE: deletePostMetadata,
} satisfies Record<string, RouteMetadata>;

export { deletePostMetadata, getPostMetadata };
