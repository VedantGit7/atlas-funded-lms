import {
  createPostCommentMetadata,
  listPostCommentsMetadata,
} from "../../../../../../server/community/community.route-metadata";

export { createPostCommentMetadata, listPostCommentsMetadata };

export const routeMetadata = {
  GET: listPostCommentsMetadata,
  POST: createPostCommentMetadata,
};
