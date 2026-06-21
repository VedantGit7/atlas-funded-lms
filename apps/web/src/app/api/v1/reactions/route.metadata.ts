import {
  createReactionMetadata,
  deleteReactionMetadata,
} from "../../../../server/community/community.route-metadata";

export { createReactionMetadata, deleteReactionMetadata };

export const routeMetadata = {
  POST: createReactionMetadata,
  DELETE: deleteReactionMetadata,
};
