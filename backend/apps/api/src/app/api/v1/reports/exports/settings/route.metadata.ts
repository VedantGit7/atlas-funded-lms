import {
  getExportSettingsMetadata,
  updateExportSettingsMetadata,
} from "@atlas/domain/reports/exports-roster.route-metadata";

export const routeMetadata = {
  GET: getExportSettingsMetadata,
  PUT: updateExportSettingsMetadata,
};
