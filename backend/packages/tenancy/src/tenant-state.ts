import type { TenantDomainStatus, TenantState } from "./types";
import { tenantNotFound, tenantUnavailable } from "./tenant-errors";

export function assertTenantDomainActive(status: TenantDomainStatus): void {
  if (status !== "ACTIVE") {
    throw tenantNotFound();
  }
}

export function assertTenantActive(state: TenantState): void {
  if (state !== "ACTIVE") {
    throw tenantUnavailable();
  }
}
