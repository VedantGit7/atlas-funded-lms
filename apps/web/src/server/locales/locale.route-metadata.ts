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
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadLocaleResourceCatalogResourceRef,
} satisfies RouteMetadata;
