import {
  createDestinationMetadata,
  listDestinationsRosterMetadata,
} from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  GET: listDestinationsRosterMetadata,
  POST: createDestinationMetadata,
};
