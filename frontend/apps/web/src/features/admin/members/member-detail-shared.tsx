import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  GraduationCap,
  MessageSquare,
  Shield,
  Star,
  User,
} from "lucide-react";
import { PERMISSIONS } from "@atlas/access/seed/permission-catalogue";

export const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const labelClassName =
  "text-[13px] font-medium text-[var(--admin-on-surface-variant)]";

export const cardClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const cardHeaderClassName =
  "flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4";

export function permissionDescription(key: string): string | null {
  const match = PERMISSIONS.find((permission) => permission.key === key);
  return match?.description ?? null;
}

export function formatJoinedDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Joined ${new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date)}`;
}

export function memberInitials(displayName: string | null, email: string | null): string {
  const source = displayName?.trim() || email?.trim() || "MB";
  const parts = source.split(/\s+/).slice(0, 2);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function statusBadgeClassName(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-[var(--admin-success)]/15 text-[var(--admin-success)]";
    case "INVITED":
      return "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]";
    case "SUSPENDED":
    case "REMOVED":
      return "bg-[var(--admin-danger)]/15 text-[var(--admin-danger)]";
    default:
      return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
}

export function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  owner: Star,
  admin: Shield,
  instructor: GraduationCap,
  moderator: MessageSquare,
  learner: User,
};

export function roleIcon(key: string): LucideIcon {
  return ROLE_ICONS[key] ?? BadgeCheck;
}

export function roleSummary(roles: Array<{ key: string; name: string }>): string {
  if (roles.some((role) => role.key === "owner")) {
    return "This member has owner-level access across the academy platform and administrative console.";
  }
  if (roles.some((role) => role.key === "admin")) {
    return "This member can manage tenant configuration, members, and day-to-day academy operations.";
  }
  if (roles.length === 0) {
    return "No roles are assigned yet. Assign a role to grant platform permissions.";
  }
  const names = roles.map((role) => role.name).join(", ");
  return `${names} ${roles.length === 1 ? "is" : "are"} assigned to this membership.`;
}
