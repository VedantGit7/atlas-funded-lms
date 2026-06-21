import {
  deleteCommentMetadata,
  updateCommentMetadata,
} from "../../../../../server/community/community.route-metadata";

export { deleteCommentMetadata, updateCommentMetadata };

export const routeMetadata = {
  PUT: updateCommentMetadata,
  DELETE: deleteCommentMetadata,
};
