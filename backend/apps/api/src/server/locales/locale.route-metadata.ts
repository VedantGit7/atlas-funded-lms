import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadLocaleResourceCatalogResourceRef } from "./locale.resource-loader";

export const listLocaleResourcesMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const upsertLocaleResourcesMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const deleteLocaleResourceMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const listLocaleMetadataMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const upsertLocaleMetadataMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const deleteLocaleMetadataMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const listLocaleCanonicalKeysMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const getLocaleCoverageMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const getLocaleOverviewMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const listLocaleReviewQueueMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const updateLocaleReviewMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const getLocaleQaChecksMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const runLocaleQaChecksMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const previewLocaleImportMetadata = {
  permission: "locale.manage",
  audit: "none",
  auditExempt: "read_only",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const importLocaleResourcesMetadata = {
  permission: "locale.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;

export const exportLocaleResourcesMetadata = {
  permission: "locale.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;
