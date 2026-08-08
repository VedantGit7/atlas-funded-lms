"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, Lock, LockKeyhole, Shield } from "lucide-react";
import {
  GeneralDetailsCard,
  PermissionCatalogueHeader,
  RoleEditorPageHeader,
  buildTenantPermissionGroups,
  formatGroupLabel,
  groupIcon,
  lockedCheckboxClassName,
  lockedFieldClassName,
  systemRoleDescription,
  type TenantPermission,
} from "./role-editor-shared";

type ProtectedRoleEditorProps = {
  role: {
    id: string;
    key: string;
    name: string;
    permissions: string[];
  };
};

function LockedControl({ children, onLockedInteraction }: { children: ReactNode; onLockedInteraction: () => void }) {
  return (
    <div
      className="contents"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.closest("button[disabled]") ||
          target.closest("input[disabled]") ||
          target.closest("textarea[disabled]")
        ) {
          onLockedInteraction();
        }
      }}
    >
      {children}
    </div>
  );
}

function ProtectedPermissionCard({
  group,
  permissions,
}: {
  group: string;
  permissions: TenantPermission[];
}) {
  const Icon = groupIcon(group);

  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 opacity-80 shadow-sm grayscale-[0.2]">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">
          {formatGroupLabel(group)}
        </h4>
      </div>
      <div className="space-y-3">
        {permissions.map((permission) => (
          <label key={permission.key} className="flex cursor-not-allowed items-center gap-3">
            <input
              type="checkbox"
              checked
              disabled
              readOnly
              aria-label={permission.key}
              className={lockedCheckboxClassName}
            />
            <span className="text-sm font-medium text-[var(--admin-on-surface)]">
              {permission.description}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ProtectedRoleEditor({ role }: ProtectedRoleEditorProps) {
  const [bannerPulse, setBannerPulse] = useState(false);

  const groupedPermissions = useMemo(() => buildTenantPermissionGroups(), []);
  const tenantPermissionCount = useMemo(
    () => groupedPermissions.reduce((count, [, permissions]) => count + permissions.length, 0),
    [groupedPermissions],
  );

  const allPermissionsGranted =
    tenantPermissionCount > 0 && role.permissions.length >= tenantPermissionCount;

  function triggerBannerPulse() {
    setBannerPulse(true);
    window.setTimeout(() => {
      setBannerPulse(false);
    }, 1000);
  }

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <RoleEditorPageHeader title={role.name} roleKey={role.key} roleTypeLabel="System role" />

      <div
        className={[
          "mb-8 flex items-center gap-4 rounded-xl border border-[var(--admin-primary)]/25 bg-[var(--admin-primary-container)]/35 p-4",
          bannerPulse ? "animate-pulse" : "",
        ].join(" ")}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]">
          <Shield className="h-5 w-5 fill-current" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-none text-[var(--admin-primary-strong)]">
            This role is fully protected.
          </h3>
          <p className="mt-1 text-sm text-[var(--admin-on-primary-container)]">
            The owner role cannot be edited or deleted as it contains core system privileges.
          </p>
        </div>
      </div>

      <LockedControl onLockedInteraction={triggerBannerPulse}>
        <div className="grid grid-cols-1 gap-8">
          <GeneralDetailsCard>
            <div className="md:col-span-1">
              <label
                htmlFor="protected-role-name"
                className="mb-2 block text-sm font-medium text-[var(--admin-on-surface-variant)]"
              >
                Role Name
              </label>
              <div className="relative">
                <input
                  id="protected-role-name"
                  type="text"
                  value={role.name}
                  disabled
                  className={lockedFieldClassName}
                />
                <Lock
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label
                htmlFor="protected-role-id"
                className="mb-2 block text-sm font-medium text-[var(--admin-on-surface-variant)]"
              >
                Role ID
              </label>
              <input
                id="protected-role-id"
                type="text"
                value={role.id}
                disabled
                className={[lockedFieldClassName, "font-mono text-xs italic"].join(" ")}
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="protected-role-description"
                className="mb-2 block text-sm font-medium text-[var(--admin-on-surface-variant)]"
              >
                Description
              </label>
              <textarea
                id="protected-role-description"
                value={systemRoleDescription(role.key)}
                disabled
                rows={4}
                className={[lockedFieldClassName, "resize-none"].join(" ")}
              />
            </div>
          </GeneralDetailsCard>

          <section>
            <PermissionCatalogueHeader
              trailing={
                allPermissionsGranted ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-primary)]">
                    <BadgeCheck className="h-[18px] w-[18px]" aria-hidden="true" />
                    All permissions granted
                  </div>
                ) : null
              }
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {groupedPermissions.map(([group, permissions]) => (
                <ProtectedPermissionCard key={group} group={group} permissions={permissions} />
              ))}
            </div>
          </section>
        </div>

        <footer className="mt-12 flex flex-col gap-4 border-t border-[var(--admin-border)] py-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 px-4 py-2 text-sm font-bold text-[var(--admin-danger)]/50"
          >
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            Delete System Role
          </button>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-[var(--admin-on-surface)]/20 px-8 py-2.5 text-sm font-bold text-[var(--admin-on-surface-variant)]"
            >
              <Lock className="h-5 w-5" aria-hidden="true" />
              Save Changes
            </button>
          </div>
        </footer>
      </LockedControl>
    </div>
  );
}
