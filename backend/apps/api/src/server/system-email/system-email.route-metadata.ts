import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadNotificationTemplateCatalogResourceRef,
} from "../notifications/notification.resource-loader";

export const listSystemEmailsMetadata = {
  permission: "notification.template.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadNotificationTemplateCatalogResourceRef,
} satisfies RouteMetadata;

export const mutateSystemEmailsMetadata = {
  permission: "notification.template.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: loadNotificationTemplateCatalogResourceRef,
} satisfies RouteMetadata;
