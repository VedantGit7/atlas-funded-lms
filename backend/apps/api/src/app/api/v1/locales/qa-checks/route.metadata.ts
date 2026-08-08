import {
  getLocaleQaChecksMetadata,
  runLocaleQaChecksMetadata,
} from "../../../../../server/locales/locale.route-metadata";

export const routeMetadata = {
  GET: getLocaleQaChecksMetadata,
  POST: runLocaleQaChecksMetadata,
};
