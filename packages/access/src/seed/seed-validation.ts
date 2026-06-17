import { PERMISSIONS, isPlatformPermission } from "./permission-catalogue";
import { ROLE_PERMISSIONS } from "./role-permission-matrix";
import { TENANT_SYSTEM_ROLES } from "./tenant-system-roles";

export function validateAccessSeedData(): void {
  const permissionKeys = new Set(PERMISSIONS.map((permission) => permission.key));
  const roleKeys = new Set(TENANT_SYSTEM_ROLES.map((role) => role.key));

  for (const permission of PERMISSIONS) {
    if (!permission.key || !permission.description || !permission.resourceType) {
      throw new Error(`Invalid permission definition: ${permission.key}`);
    }
  }

  for (const roleKey of Object.keys(ROLE_PERMISSIONS)) {
    if (!roleKeys.has(roleKey as never)) {
      throw new Error(`Unknown tenant system role in role matrix: ${roleKey}`);
    }

    for (const permissionKey of ROLE_PERMISSIONS[roleKey as keyof typeof ROLE_PERMISSIONS]) {
      if (!permissionKeys.has(permissionKey)) {
        throw new Error(`Role ${roleKey} references unknown permission: ${permissionKey}`);
      }

      if (isPlatformPermission(permissionKey)) {
        throw new Error(
          `Tenant role ${roleKey} cannot include platform permission: ${permissionKey}`,
        );
      }
    }
  }
}
