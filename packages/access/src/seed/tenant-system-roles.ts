export type TenantSystemRoleKey = "owner" | "admin" | "instructor" | "moderator" | "learner";

export type TenantSystemRoleDefinition = {
  key: TenantSystemRoleKey;
  name: string;
  description: string;
  isSystem: true;
};

export const TENANT_SYSTEM_ROLES: readonly TenantSystemRoleDefinition[] = [
  {
    key: "owner",
    name: "Owner",
    description: "Ultimate tenant authority. Admin plus owner-only controls.",
    isSystem: true,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Day-to-day tenant administration and configuration.",
    isSystem: true,
  },
  {
    key: "instructor",
    name: "Instructor",
    description:
      "Learning authoring, assessment, grading, and learner progress for assigned/owned resources.",
    isSystem: true,
  },
  {
    key: "moderator",
    name: "Moderator",
    description: "Community moderation and appeals within tenant scope.",
    isSystem: true,
  },
  {
    key: "learner",
    name: "Learner",
    description:
      "Default member role for learning, practice, progress, certificates, community participation, and self-service.",
    isSystem: true,
  },
] as const;

export const DEFAULT_ACCEPTED_MEMBER_ROLE: TenantSystemRoleKey = "learner";
