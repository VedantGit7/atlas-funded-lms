export const ATLAS_INTERNAL_TENANT_ID_HEADER = "x-atlas-tenant-id";
export const ATLAS_INTERNAL_TENANT_DOMAIN_ID_HEADER = "x-atlas-tenant-domain-id";
export const ATLAS_INTERNAL_TENANT_STATE_HEADER = "x-atlas-tenant-state";
export const ATLAS_INTERNAL_REQUEST_ID_HEADER = "x-atlas-request-id";

export const SPOOFABLE_TENANT_HEADERS = [
  ATLAS_INTERNAL_TENANT_ID_HEADER,
  ATLAS_INTERNAL_TENANT_DOMAIN_ID_HEADER,
  ATLAS_INTERNAL_TENANT_STATE_HEADER,
  "x-tenant-id",
  "x-tenant",
  "x-org-id",
] as const;
