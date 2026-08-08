export type TenantState = "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "DELETED";

export type TenantDomainStatus =
  | "PENDING"
  | "VERIFYING"
  | "ACTIVE"
  | "FAILED"
  | "REMOVED"
  | "ERROR";

export type ResolvedTenantContext = {
  requestId: string;
  host: string;
  tenantId: string;
  tenantSlug: string;
  tenantState: TenantState;
  tenantDomainId: string;
  tenantDomainStatus: TenantDomainStatus;
};
