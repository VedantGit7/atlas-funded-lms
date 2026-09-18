export type TenantSystemRoleKey = "owner" | "admin" | "instructor" | "moderator" | "learner";

export type TenantSystemRoleDefinition = {
  key: TenantSystemRoleKey;
  name: string;
  description: string;
  isSystem: true;
  /**
   * H11: skip ownership and relationship predicates in `can()`.
   *
   * This used to be `roleKeys.includes("owner") || roleKeys.includes("admin")`
   * inside `can()`, which meant the bypass was invisible in the data and any
   * custom role keyed "admin" inherited it. It is a property of the role now,
   * so it can be reviewed and revoked without a deploy.
   */
  bypassesResourcePredicates: boolean;
};

export const TENANT_SYSTEM_ROLES: readonly TenantSystemRoleDefinition[] = [
  {
    key: "owner",
    name: "Owner",
    description: "Ultimate tenant authority. Admin plus owner-only controls.",
    isSystem: true,
    bypassesResourcePredicates: true,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Day-to-day tenant administration and configuration.",
    isSystem: true,
    bypassesResourcePredicates: true,
  },
  {
    key: "instructor",
    name: "Instructor",
    description:
      "Learning authoring, assessment, grading, and learner progress for assigned/owned resources.",
    isSystem: true,
    bypassesResourcePredicates: false,
  },
  {
    key: "moderator",
    name: "Moderator",
    description: "Community moderation and appeals within tenant scope.",
    isSystem: true,
    bypassesResourcePredicates: false,
  },
  {
    key: "learner",
    name: "Learner",
    description:
      "Default member role for learning, practice, progress, certificates, community participation, and self-service.",
    isSystem: true,
    bypassesResourcePredicates: false,
  },
] as const;

export const DEFAULT_ACCEPTED_MEMBER_ROLE: TenantSystemRoleKey = "learner";
