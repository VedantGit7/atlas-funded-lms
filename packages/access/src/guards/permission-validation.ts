import { isPlatformPermission } from "../seed/permission-catalogue";

export function isWildcardPermission(key: string): boolean {
  return key.includes("*");
}

export function assertTenantScopedPermissionKey(key: string): void {
  if (isPlatformPermission(key)) {
    throw new Error("PLATFORM_PERMISSION_FORBIDDEN");
  }
  if (isWildcardPermission(key)) {
    throw new Error("WILDCARD_PERMISSION_FORBIDDEN");
  }
}

export function assertTenantScopedPermissionKeys(keys: readonly string[]): void {
  for (const key of keys) {
    assertTenantScopedPermissionKey(key);
  }
}
