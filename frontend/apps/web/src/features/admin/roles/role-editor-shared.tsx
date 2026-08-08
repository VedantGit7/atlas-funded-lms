"use client";

import Link from "next/link";
import { useEffect, useRef, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CreditCard,
  Globe,
  GraduationCap,
  History,
  MessageSquare,
  Server,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS } from "@atlas/access/seed/permission-catalogue";
import { TENANT_SYSTEM_ROLES } from "@atlas/access/seed/tenant-system-roles";

export type TenantPermission = {
  key: string;
  description: string;
  group: string;
};

export const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-medium text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60";

export const lockedFieldClassName =
  "w-full cursor-not-allowed rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)] opacity-70 outline-none";

export const checkboxClassName =
  "h-5 w-5 shrink-0 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

export const lockedCheckboxClassName =
  "h-5 w-5 shrink-0 cursor-not-allowed rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:opacity-100";

const GROUP_ICONS: Record<string, LucideIcon> = {
  membership: Users,
  profile: Users,
  role: Shield,
  permission_override: Shield,
  tenancy: Globe,
  branding: BookOpen,
  config: Server,
  feature_flag: Server,
  entitlement: CreditCard,
  course: GraduationCap,
  enrollment: GraduationCap,
  progress: GraduationCap,
  learning_path: GraduationCap,
  item: BookOpen,
  assessment: GraduationCap,
  attempt: GraduationCap,
  practice: GraduationCap,
  competency: BadgeCheck,
  scoring_profile: BadgeCheck,
  scoring_config: BadgeCheck,
  certificate_template: BadgeCheck,
  certificate: BadgeCheck,
  gamification: BadgeCheck,
  badge: BadgeCheck,
  leaderboard: BadgeCheck,
  community: MessageSquare,
  post: MessageSquare,
  comment: MessageSquare,
  reaction: MessageSquare,
  appeal: MessageSquare,
  notification: Server,
  search: Server,
  workflow: Server,
  automation: Server,
  locale: Globe,
  extension: Server,
  diagnostic: Server,
  readiness_policy: Shield,
  data: Shield,
  audit: History,
  moderation: MessageSquare,
};

export function permissionGroupKey(key: string): string {
  const [group] = key.split(".");
  return group && group.length > 0 ? group : "other";
}

export function formatGroupLabel(group: string): string {
  return group.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function groupIcon(group: string): LucideIcon {
  return GROUP_ICONS[group] ?? Shield;
}

export function systemRoleDescription(key: string): string {
  const definition = TENANT_SYSTEM_ROLES.find((role) => role.key === key);
  return definition?.description ?? "System role with predefined platform permissions.";
}

export function buildTenantPermissionGroups(): [string, TenantPermission[]][] {
  const tenantPermissions = PERMISSIONS.filter((permission) => !permission.platformOnly).map(
    (permission) => ({
      key: permission.key,
      description: permission.description,
      group: permissionGroupKey(permission.key),
    }),
  );

  const groups = new Map<string, TenantPermission[]>();
  for (const permission of tenantPermissions) {
    const list = groups.get(permission.group) ?? [];
    list.push(permission);
    groups.set(permission.group, list);
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function formatRelativeUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffHours, "hour");
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffDays, "day");
}

export function RoleEditorPageHeader({
  title,
  roleKey,
  roleTypeLabel,
  auditLogDisabled = true,
}: {
  title: string;
  roleKey: string;
  roleTypeLabel: string;
  auditLogDisabled?: boolean;
}) {
  return (
    <header className="mb-8">
      <Link
        href="/admin/roles"
        className="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
      >
        <ArrowLeft
          className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        Roles
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--admin-on-surface)] sm:text-[40px]">
            {title}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-base text-[var(--admin-on-surface-variant)]">
            <span>{roleKey}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--admin-outline)]" aria-hidden="true" />
            <span>{roleTypeLabel}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={auditLogDisabled}
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] opacity-50"
        >
          <History className="h-[18px] w-[18px]" aria-hidden="true" />
          Audit Log
        </button>
      </div>
    </header>
  );
}

export function GeneralDetailsCard({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 px-6 py-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
          General Details
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function PermissionCatalogueHeader({
  trailing,
}: {
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">Permission Catalogue</h3>
      {trailing}
    </div>
  );
}

export function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      onChange={onChange}
      onClick={(event) => {
        event.stopPropagation();
      }}
    />
  );
}
