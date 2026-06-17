export type PermissionKey = string;

export type AuthorizationActor = {
  tenantId: string;
  membershipId: string;
};

export type AuthorizationContext = {
  tenantId: string;
  requestId: string;
};

export type ResourceRelationshipMap = Record<
  string,
  boolean | string | string[] | null | undefined
>;

export type ResourceRef = {
  type: string;
  id: string;
  tenantId: string;
  tenantScoped: true;
  ownerMembershipId?: string | null;
  relationships?: ResourceRelationshipMap;
};

export type RolePermissionGrant = {
  permissionKey: string;
  roleKeys: string[];
};

export type PermissionOverrideEffect = "ALLOW" | "DENY";

export type PermissionOverrideDecision = {
  effect: PermissionOverrideEffect;
  permissionKey: string;
};

export type AuthorizationDenyReason =
  | "DEFAULT_DENY"
  | "TENANT_MISMATCH"
  | "UNKNOWN_PERMISSION"
  | "PLATFORM_PERMISSION_IN_TENANT_SCOPE"
  | "EXPLICIT_DENY"
  | "NO_ROLE_GRANT"
  | "OWNERSHIP_REQUIRED"
  | "RELATIONSHIP_REQUIRED";

export type AuthorizationDecision =
  | {
      allowed: true;
      permission: PermissionKey;
      reason: "ALLOWED";
      matchedRoleKeys: string[];
      bypassedResourcePredicate: boolean;
    }
  | {
      allowed: false;
      permission: PermissionKey;
      reason: AuthorizationDenyReason;
      safeMessage: string;
    };
