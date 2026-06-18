import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { lookupTenantFromHost } from "@atlas/tenancy";
import type { ResolvedTenantContext, TenantState } from "@atlas/tenancy";
import { withGlobalDb } from "@atlas/db/global-db";

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

export async function runTenantStateGate(): Promise<TenantStateGateResult> {
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList) || randomUUID();
  const host = headerList.get("host") ?? "localhost";

  return withGlobalDb(async (db) => {
    const tenant = await lookupTenantFromHost({ host, requestId, db });

    if (!tenant) {
      return { kind: "not_found", requestId };
    }

    if (tenant.tenantState === "DELETED") {
      return { kind: "not_found", requestId };
    }

    const reason = classifyUnavailableTenant(tenant);

    if (reason) {
      return { kind: "unavailable", reason, tenant, requestId };
    }

    return { kind: "ok", tenant };
  });
}

export function tenantStateToUnavailableReason(state: TenantState): TenantUnavailableReason {
  switch (state) {
    case "ACTIVE":
      throw new Error("ACTIVE tenant is not unavailable");
    case "PROVISIONING":
      return "PROVISIONING";
    case "SUSPENDED":
      return "SUSPENDED";
    case "ARCHIVED":
    case "DELETED":
      return "ARCHIVED";
  }
}
