import { findAuthorizationFacts } from "./authorization.repository";
import { allowsOwnershipOrRelationship } from "./ownership-or-relationship-permissions";
import { actorOwnsResource, requiresOwnership } from "./ownership-predicates";
import { hasRequiredRelationship, requiredRelationships } from "./relationship-predicates";
import type {
  AuthorizationActor,
  AuthorizationContext,
  AuthorizationDecision,
  ResourceRef,
} from "./types";

type Tx = Parameters<typeof findAuthorizationFacts>[0]["tx"];

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

  // One round trip for the catalogue entry, override and role grants; the
  // checks below still apply in the same order.
  const { permissionExists, override, grant } = await findAuthorizationFacts({
    tx: args.tx,
    tenantId: args.ctx.tenantId,
    membershipId: args.actor.membershipId,
    permissionKey: args.permission,
  });

  if (!permissionExists) {
    return deny(args.permission, "UNKNOWN_PERMISSION");
  }

  if (args.permission.startsWith("platform.")) {
    return deny(args.permission, "PLATFORM_PERMISSION_IN_TENANT_SCOPE");
  }

  if (override?.effect === "DENY") {
    return deny(args.permission, "EXPLICIT_DENY");
  }

  const roleKeys = grant?.roleKeys ?? [];
  const hasOverrideAllow = override?.effect === "ALLOW";
  const hasRoleGrant = roleKeys.length > 0;

  if (!hasOverrideAllow && !hasRoleGrant) {
    return deny(args.permission, "NO_ROLE_GRANT");
  }

  // H11: read from the role record, never from its key. This was
  // `roleKeys.includes("owner") || roleKeys.includes("admin")`, which made the
  // bypass invisible in the data, unrevocable without a deploy, and inheritable
  // by any custom role that happened to be named "admin".
  const bypassedResourcePredicate = grant?.bypassesResourcePredicates ?? false;
  const requiredRelationshipKeys = requiredRelationships(args.permission);
  const ownsResource = actorOwnsResource({ actor: args.actor, resource: args.resource });
  const hasRelationship =
    requiredRelationshipKeys.length === 0 ||
    hasRequiredRelationship({
      actor: args.actor,
      resource: args.resource,
      permission: args.permission,
    });

  if (!bypassedResourcePredicate && requiresOwnership(args.permission)) {
    if (allowsOwnershipOrRelationship(args.permission)) {
      if (!ownsResource && !hasRelationship) {
        return deny(args.permission, "OWNERSHIP_REQUIRED");
      }
    } else if (!ownsResource) {
      return deny(args.permission, "OWNERSHIP_REQUIRED");
    }
  }

  if (
    !bypassedResourcePredicate &&
    requiredRelationshipKeys.length > 0 &&
    !allowsOwnershipOrRelationship(args.permission)
  ) {
    if (!hasRelationship) {
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
