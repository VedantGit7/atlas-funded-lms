import type { TenantDomainStatus, TenantState } from "./types";
import { tenantDomainInactive, tenantUnavailable } from "./tenant-errors";

export function assertTenantDomainActive(status: TenantDomainStatus): void {
  if (status !== "ACTIVE") {
    throw tenantDomainInactive();
  }
}

export function assertTenantActive(state: TenantState): void {
  if (state !== "ACTIVE") {
    throw tenantUnavailable();
  }
}
