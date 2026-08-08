import { AtlasHttpError } from "@atlas/core/http/errors";

export function tenantNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "TENANT_NOT_FOUND",
    status: 404,
    message: "Tenant not found",
  });
}

export function tenantDomainInactive(): AtlasHttpError {
  return new AtlasHttpError({
    code: "TENANT_DOMAIN_INACTIVE",
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
