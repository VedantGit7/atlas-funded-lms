import { cache } from "react";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getOrCreateRequestId } from "../request-id";
import type { ResolvedTenantContext } from "../tenant-types";
import { ServerApiError } from "../api/errors";
import { loadPublicBootstrap } from "./bootstrap";

export type TenantUnavailableReason = "PROVISIONING" | "SUSPENDED" | "ARCHIVED" | "DOMAIN_INACTIVE";

export type TenantStateGateResult =
  | { kind: "ok"; tenant: ResolvedTenantContext }
  | {
      kind: "unavailable";
      reason: TenantUnavailableReason;
      tenant: ResolvedTenantContext;
      requestId: string;
    }
  | { kind: "not_found"; requestId: string };

function classifyUnavailableTenant(tenant: ResolvedTenantContext): TenantUnavailableReason | null {
  if (tenant.tenantDomainStatus !== "ACTIVE") {
    return "DOMAIN_INACTIVE";
  }

  switch (tenant.tenantState) {
    case "ACTIVE":
      return null;
    case "PROVISIONING":
      return "PROVISIONING";
    case "SUSPENDED":
      return "SUSPENDED";
    case "ARCHIVED":
      return "ARCHIVED";
    case "DELETED":
      return "ARCHIVED";
  }
}

export const runTenantStateGate = cache(async (): Promise<TenantStateGateResult> => {
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList) || randomUUID();
  const host = headerList.get("host") ?? "localhost";

  let bootstrap;
  try {
    bootstrap = await loadPublicBootstrap();
  } catch (error) {
    if (error instanceof ServerApiError && error.code === "TENANT_NOT_FOUND") {
      return { kind: "not_found", requestId };
    }
    throw error;
  }

  if (!bootstrap.tenantId || !bootstrap.tenantState) {
    return { kind: "not_found", requestId };
  }

  if (bootstrap.tenantState === "DELETED") {
    return { kind: "not_found", requestId };
  }

  const tenant: ResolvedTenantContext = {
    tenantId: bootstrap.tenantId,
    tenantSlug: bootstrap.tenantSlug ?? "",
    tenantState: bootstrap.tenantState,
    tenantDomainId: bootstrap.tenantDomainId ?? "",
    tenantDomainStatus: bootstrap.tenantDomainStatus ?? "FAILED",
    host,
    requestId,
  };

  const unavailableReason = classifyUnavailableTenant(tenant);
  if (unavailableReason) {
    return { kind: "unavailable", reason: unavailableReason, tenant, requestId };
  }

  return { kind: "ok", tenant };
});
