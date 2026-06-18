import { AtlasHttpError } from "@atlas/core/http/errors";
import { actorIsOwner, isAdminRole, isOwnerRole } from "./role-rank";

function permissionDenied(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message,
  });
}

export function assertTargetIsNotOwner(hasOwnerRole: boolean): void {
  if (hasOwnerRole) {
    throw permissionDenied("The owner membership cannot be modified.");
  }
}

export function assertCannotAssignOwnerRole(roleKey: string): void {
  if (isOwnerRole(roleKey)) {
    throw permissionDenied("The owner role cannot be assigned.");
  }
}

export function assertRoleAssignRankGuard(args: {
  actorRoleKeys: readonly string[];
  targetRoleKey: string;
}): void {
  assertCannotAssignOwnerRole(args.targetRoleKey);

  if (isAdminRole(args.targetRoleKey) && !actorIsOwner(args.actorRoleKeys)) {
    throw permissionDenied("Only the owner may assign the admin role.");
  }
}

export function assertRoleRevokeRankGuard(args: {
  actorRoleKeys: readonly string[];
  targetRoleKey: string;
}): void {
  if (isOwnerRole(args.targetRoleKey)) {
    throw permissionDenied("The owner role cannot be revoked.");
  }

  if (isAdminRole(args.targetRoleKey) && !actorIsOwner(args.actorRoleKeys)) {
    throw permissionDenied("Only the owner may revoke the admin role.");
  }
}

export function assertRoleEditGuard(args: {
  actorRoleKeys: readonly string[];
  roleKey: string;
  isSystem: boolean;
}): void {
  if (isOwnerRole(args.roleKey)) {
    throw permissionDenied("The owner role cannot be edited.");
  }
}

export function assertSystemRoleDeleteGuard(isSystem: boolean): void {
  if (isSystem) {
    throw permissionDenied("System roles cannot be deleted.");
  }
}
