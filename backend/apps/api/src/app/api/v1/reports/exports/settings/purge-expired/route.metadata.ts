import { purgeExpiredExportsMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  POST: purgeExpiredExportsMetadata,
};
