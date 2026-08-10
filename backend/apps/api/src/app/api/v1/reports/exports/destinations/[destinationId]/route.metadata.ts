import {
  deleteDestinationMetadata,
  updateDestinationMetadata,
} from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  PATCH: updateDestinationMetadata,
  DELETE: deleteDestinationMetadata,
};
