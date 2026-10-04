export type PlatformRoleKey = "super_admin" | "operations" | "support";

const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRoleKey, readonly string[]> = {
  super_admin: [
    "platform.tenant.read",
    "platform.tenant.manage",
    "platform.entitlement.manage",
    "platform.feature_flag.manage",
    "platform.catalog.manage",
    "platform.audit.read",
    "platform.support.access",
    "platform.identity.manage",
  ],
  operations: [
    "platform.tenant.read",
    "platform.tenant.manage",
    "platform.entitlement.manage",
    "platform.feature_flag.manage",
    "platform.audit.read",
    "platform.support.access",
  ],
  support: ["platform.tenant.read", "platform.audit.read", "platform.support.access"],
};

function parsePlatformOperatorAssignments(raw: string): Map<string, PlatformRoleKey> {
  const assignments = new Map<string, PlatformRoleKey>();

  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const [email, role] = trimmed.split("=").map((part) => part.trim().toLowerCase());
    if (!email || !role) {
      continue;
    }

    if (role === "super_admin" || role === "operations" || role === "support") {
      assignments.set(email, role);
    }
  }

  return assignments;
}

function resolvePlatformPermissionsForRole(role: PlatformRoleKey): readonly string[] {
  return PLATFORM_ROLE_PERMISSIONS[role];
}

export {
  PLATFORM_ROLE_PERMISSIONS,
  parsePlatformOperatorAssignments,
  resolvePlatformPermissionsForRole,
};
