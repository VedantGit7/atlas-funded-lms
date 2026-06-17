import {
  findPermissionOverride,
  findRolePermissionGrant,
  permissionExists,
} from "./authorization.repository";
import { actorOwnsResource, requiresOwnership } from "./ownership-predicates";
import { hasRequiredRelationship, requiredRelationships } from "./relationship-predicates";
import type {
  AuthorizationActor,
  AuthorizationContext,
  AuthorizationDecision,
  ResourceRef,
} from "./types";

type Tx = Parameters<typeof permissionExists>[0]["tx"];

function deny(
  permission: string,
  reason: Exclude<AuthorizationDecision, { allowed: true }>["reason"],
): AuthorizationDecision {
  return {
    allowed: false,
    permission,
    reason,
    safeMessage: "You do not have access to perform this action.",
  };
}

function isAdminBypassRole(roleKeys: string[]): boolean {
  return roleKeys.includes("owner") || roleKeys.includes("admin");
}

export async function can(args: {
  tx: Tx;
  actor: AuthorizationActor;
  permission: string;
  resource: ResourceRef;
  ctx: AuthorizationContext;
}): Promise<AuthorizationDecision> {
  if (args.actor.tenantId !== args.ctx.tenantId) {
    return deny(args.permission, "TENANT_MISMATCH");
  }

  if (args.resource.tenantId !== args.ctx.tenantId) {
    return deny(args.permission, "TENANT_MISMATCH");
  }

  const permission = await permissionExists({
    tx: args.tx,
    permissionKey: args.permission,
  });

  if (!permission.exists) {
    return deny(args.permission, "UNKNOWN_PERMISSION");
  }

  if (permission.platformOnly || args.permission.startsWith("platform.")) {
    return deny(args.permission, "PLATFORM_PERMISSION_IN_TENANT_SCOPE");
  }

  const override = await findPermissionOverride({
    tx: args.tx,
    tenantId: args.ctx.tenantId,
    membershipId: args.actor.membershipId,
    permissionKey: args.permission,
  });

  if (override?.effect === "DENY") {
    return deny(args.permission, "EXPLICIT_DENY");
  }

  const grant = await findRolePermissionGrant({
    tx: args.tx,
    tenantId: args.ctx.tenantId,
    membershipId: args.actor.membershipId,
    permissionKey: args.permission,
  });

  const roleKeys = grant?.roleKeys ?? [];
  const hasOverrideAllow = override?.effect === "ALLOW";
  const hasRoleGrant = roleKeys.length > 0;

  if (!hasOverrideAllow && !hasRoleGrant) {
    return deny(args.permission, "NO_ROLE_GRANT");
  }

  const bypassedResourcePredicate = isAdminBypassRole(roleKeys);

  if (!bypassedResourcePredicate && requiresOwnership(args.permission)) {
    if (!actorOwnsResource({ actor: args.actor, resource: args.resource })) {
      return deny(args.permission, "OWNERSHIP_REQUIRED");
    }
  }

  if (!bypassedResourcePredicate && requiredRelationships(args.permission).length > 0) {
    if (
      !hasRequiredRelationship({
        actor: args.actor,
        resource: args.resource,
        permission: args.permission,
      })
    ) {
      return deny(args.permission, "RELATIONSHIP_REQUIRED");
    }
  }

  return {
    allowed: true,
    permission: args.permission,
    reason: "ALLOWED",
    matchedRoleKeys: roleKeys,
    bypassedResourcePredicate,
  };
}
