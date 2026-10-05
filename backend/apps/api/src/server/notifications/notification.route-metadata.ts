import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadNotificationTemplateCatalogResourceRef,
  loadNotificationTemplateResourceRefFromBody,
  loadSelfNotificationDispatchResourceRef,
  loadSelfNotificationInboxResourceRef,
} from "./notification.resource-loader";

export const listNotificationTemplatesMetadata = {
  permission: "notification.template.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadNotificationTemplateCatalogResourceRef,
} satisfies RouteMetadata;

export const mutateNotificationTemplatesMetadata = {
  permission: "notification.template.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadNotificationTemplateCatalogResourceRef,
} satisfies RouteMetadata;

export const updateNotificationTemplateMetadata = {
  permission: "notification.template.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadNotificationTemplateResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const deleteNotificationTemplateMetadata = {
  permission: "notification.template.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadNotificationTemplateResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const listMyNotificationsMetadata = {
  permission: "notification.read.self",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadSelfNotificationInboxResourceRef({ ctx }),
} satisfies RouteMetadata;

export const markNotificationReadMetadata = {
  permission: "notification.read.self",
  audit: "none",
  auditExempt: "own_preferences",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadSelfNotificationDispatchResourceRef({
      tx,
      ctx,
      dispatchId: params["id"] ?? "",
    }),
} satisfies RouteMetadata;

export const markNotificationArchivedMetadata = {
  permission: "notification.read.self",
  audit: "none",
  auditExempt: "own_preferences",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, params }) =>
    loadSelfNotificationDispatchResourceRef({
      tx,
      ctx,
      dispatchId: params["id"] ?? "",
    }),
} satisfies RouteMetadata;
