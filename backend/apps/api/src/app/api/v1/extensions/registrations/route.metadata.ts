import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadExtensionRegistrationManageResourceRef } from "@atlas/api-server/item-registry/item-registry.resource-loaders";

export const getExtensionRegistrationsRouteMetadata = {
  permission: "extension.registration.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadExtensionRegistrationManageResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postExtensionRegistrationsRouteMetadata = {
  permission: "extension.registration.manage",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadExtensionRegistrationManageResourceRef({ ctx }),
} satisfies RouteMetadata;

export const putExtensionRegistrationsRouteMetadata = {
  permission: "extension.registration.manage",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadExtensionRegistrationManageResourceRef({ ctx }),
} satisfies RouteMetadata;

export const deleteExtensionRegistrationsRouteMetadata = {
  permission: "extension.registration.manage",
  mfa: "required",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadExtensionRegistrationManageResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getExtensionRegistrationsRouteMetadata;
