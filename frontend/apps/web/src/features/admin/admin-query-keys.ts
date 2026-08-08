import { clearClientDataCache, tenantQueryKey } from "../../lib/query/client-data-cache";

export function adminMembersQueryKey(scope: string): readonly unknown[] {
  return tenantQueryKey(scope, ["admin", "members"]);
}

export function adminRolesQueryKey(scope: string): readonly unknown[] {
  return tenantQueryKey(scope, ["admin", "roles"]);
}

export function adminAuditQueryKey(
  scope: string,
  filter: Record<string, unknown> = {},
): readonly unknown[] {
  return tenantQueryKey(scope, ["admin", "audit", filter]);
}

export function adminExportsQueryKey(scope: string): readonly unknown[] {
  return tenantQueryKey(scope, ["admin", "exports"]);
}

export function adminDeletionRequestsQueryKey(scope: string): readonly unknown[] {
  return tenantQueryKey(scope, ["admin", "deletion-requests"]);
}

export function invalidateAdminCaches(
  scope: string,
  reason: "logout" | "membership_failure" | "host_change" = "membership_failure",
): void {
  void adminMembersQueryKey(scope);
  void adminRolesQueryKey(scope);
  void adminAuditQueryKey(scope);
  void adminExportsQueryKey(scope);
  void adminDeletionRequestsQueryKey(scope);
  clearClientDataCache(reason);
}
