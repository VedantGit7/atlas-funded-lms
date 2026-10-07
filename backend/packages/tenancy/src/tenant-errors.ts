import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * An unknown, deleted or unverified host. One error for all three, so a caller
 * probing hostnames cannot tell a pending custom-domain claim from a name
 * nobody registered (docs/runbooks/tenant-host-resolution.md).
 */
export function tenantNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "TENANT_NOT_FOUND",
    status: 404,
    message: "Tenant not found",
  });
}

export function tenantUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "TENANT_UNAVAILABLE",
    status: 503,
    message: "Tenant unavailable",
  });
}
