import {
  deleteSpaceMetadata,
  listSpacesMetadata,
  manageSpacesMetadata,
  updateSpaceMetadata,
} from "../../../../server/community/community.route-metadata";

export { deleteSpaceMetadata, listSpacesMetadata, manageSpacesMetadata, updateSpaceMetadata };

export const routeMetadata = listSpacesMetadata;
