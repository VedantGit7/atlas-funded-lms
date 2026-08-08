import type { TenantSystemRoleKey } from "../seed/tenant-system-roles";

const ROLE_RANK: Record<TenantSystemRoleKey, number> = {
  owner: 5,
  admin: 4,
  instructor: 3,
  moderator: 2,
  learner: 1,
};

export function roleRank(roleKey: string): number {
  if (roleKey in ROLE_RANK) {
    return ROLE_RANK[roleKey as TenantSystemRoleKey];
  }
  return 0;
}

export function isOwnerRole(roleKey: string): boolean {
  return roleKey === "owner";
}

export function isAdminRole(roleKey: string): boolean {
  return roleKey === "admin";
}

export function actorIsOwner(actorRoleKeys: readonly string[]): boolean {
  return actorRoleKeys.includes("owner");
}
