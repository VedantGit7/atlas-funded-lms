export {
  findActiveEntitlementByKey,
  listActiveEntitlements,
  type ActiveEntitlementRow,
} from "./repositories/entitlement.repository";

export {
  consumeEntitlementUsage,
  readEntitlementUsage,
  type ConsumeResult,
  type UsageSnapshot,
} from "./repositories/entitlement-usage.repository";

export {
  parseEntitlementValue,
  entitlementValueSchema,
  usagePeriodSchema,
  type EntitlementValue,
} from "./schemas/entitlement-value";
export {
  listTenantFeatureFlags,
  updateTenantFeatureFlagOverride,
} from "./services/feature-flag.service";
export { listTenantEntitlements } from "./services/entitlement.service";
export {
  publishTenantConfig,
  readTenantConfig,
  readTenantConfigVersions,
  updateTenantConfigDraft,
} from "./services/tenant-config.service";
export {
  listPlatformFeatureFlags,
  createPlatformFeatureFlag,
  updatePlatformFeatureFlag,
} from "./services/platform-feature-flag.service";
export {
  listPlatformPermissionCatalog,
  createPlatformPermissionCatalogEntry,
  listPlatformItemTypeCatalog,
  createPlatformItemTypeCatalogEntry,
  listPlatformExtensionPointCatalog,
  createPlatformExtensionPointCatalogEntry,
} from "./services/platform-catalog.service";
export {
  PlatformFeatureFlagListResponseSchema,
  PlatformFeatureFlagViewSchema,
  CreatePlatformFeatureFlagRequestSchema,
  UpdatePlatformFeatureFlagRequestSchema,
  PlatformFeatureFlagParamsSchema,
} from "./schemas/platform-feature-flags";
export {
  PlatformPermissionCatalogListResponseSchema,
  PlatformItemTypeCatalogListResponseSchema,
  PlatformExtensionPointCatalogListResponseSchema,
  PlatformPermissionCatalogEntrySchema,
  PlatformItemTypeCatalogEntrySchema,
  PlatformExtensionPointCatalogEntrySchema,
  CreatePlatformPermissionRequestSchema,
  CreatePlatformItemTypeRequestSchema,
  CreatePlatformExtensionPointRequestSchema,
} from "./schemas/platform-catalog";
