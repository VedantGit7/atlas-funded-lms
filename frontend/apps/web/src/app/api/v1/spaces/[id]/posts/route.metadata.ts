import {
  createSpacePostMetadata,
  listSpacePostsMetadata,
} from "../../../../../../server/community/community.route-metadata";

export { createSpacePostMetadata, listSpacePostsMetadata };

export const routeMetadata = {
  GET: listSpacePostsMetadata,
  POST: createSpacePostMetadata,
};
