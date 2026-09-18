// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type {
  UpsertLocaleResourcesBody,
  UpsertLocaleMetadataBody,
  UpdateLocaleReviewBody,
  LocaleImportPreviewBody,
  LocaleImportBody,
} from "./locale.dto";

export {
  localeCodeSchema,
  localeResourceKeySchema,
  localeResourceListResponseSchema,
  localeResourceUpsertResponseSchema,
  upsertLocaleResourcesBodySchema,
  deleteLocaleResourceResponseSchema,
  localeMetadataListResponseSchema,
  upsertLocaleMetadataBodySchema,
  localeMetadataUpsertResponseSchema,
  localeMetadataDeleteResponseSchema,
  localeCanonicalKeyListResponseSchema,
  localeCoverageResponseSchema,
  localeOverviewResponseSchema,
  localeReviewQueueResponseSchema,
  updateLocaleReviewBodySchema,
  localeReviewUpdateResponseSchema,
  localeQaChecksResponseSchema,
  runLocaleQaChecksResponseSchema,
  localeImportPreviewBodySchema,
  localeImportPreviewResponseSchema,
  localeImportBodySchema,
  localeImportResponseSchema,
  localeExportResponseSchema,
  localeExportFormatSchema,
  localeExportQuerySchema,
} from "./locale.dto";
