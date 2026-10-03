export type PlatformRoleKey = "super_admin" | "operations" | "support";

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRoleKey, readonly string[]> = {
  super_admin: [
    "platform.tenant.read",
    "platform.tenant.manage",
    "platform.entitlement.manage",
    "platform.feature_flag.manage",
    "platform.catalog.manage",
    "platform.audit.read",
    "platform.support.access",
    "platform.cost.read",
    "platform.cost.manage",
  ],
  operations: [
    "platform.tenant.read",
    "platform.tenant.manage",
    "platform.entitlement.manage",
    "platform.feature_flag.manage",
    "platform.audit.read",
    "platform.support.access",
    // Operations owns the supplier accounts, so it keeps the rate card current.
    "platform.cost.read",
    "platform.cost.manage",
  ],
  // Support deliberately has no cost access: supplier pricing and per-tenant
  // margins are commercial information a support agent has no need to see.
  support: ["platform.tenant.read", "platform.audit.read", "platform.support.access"],
};

export function resolvePlatformPermissionsForRole(role: PlatformRoleKey): readonly string[] {
  return PLATFORM_ROLE_PERMISSIONS[role];
}

export function parsePlatformOperatorAssignments(raw: string): Map<string, PlatformRoleKey> {
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
