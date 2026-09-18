"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { History, TriangleAlert } from "lucide-react";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ProtectedRoleEditor } from "./ProtectedRoleEditor";
import {
  GeneralDetailsCard,
  IndeterminateCheckbox,
  PermissionCatalogueHeader,
  RoleEditorPageHeader,
  buildTenantPermissionGroups,
  checkboxClassName,
  fieldClassName,
  formatGroupLabel,
  formatRelativeUpdatedAt,
  groupIcon,
  lockedFieldClassName,
  systemRoleDescription,
  type TenantPermission,
} from "./role-editor-shared";

type RoleEditorProps = {
  role: {
    id: string;
    key: string;
    name: string;
    isSystem: boolean;
    permissions: string[];
    updatedAt: string;
  };
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function EditablePermissionCard({
  group,
  permissions,
  selected,
  onToggleGroup,
  onTogglePermission,
}: {
  group: string;
  permissions: TenantPermission[];
  selected: string[];
  onToggleGroup: (checked: boolean) => void;
  onTogglePermission: (key: string) => void;
}) {
  const Icon = groupIcon(group);
  const enabledPermissions = permissions.filter(
    (permission) => !permission.key.startsWith("platform.") && !permission.key.includes("*"),
  );
  const selectedCount = enabledPermissions.filter((permission) =>
    selected.includes(permission.key),
  ).length;
  const allSelected = enabledPermissions.length > 0 && selectedCount === enabledPermissions.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
          <h4 className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
            {formatGroupLabel(group)}
          </h4>
          <span className="shrink-0 rounded bg-[var(--admin-surface-variant)] px-1.5 py-0.5 text-xs font-medium text-[var(--admin-on-surface-variant)]">
            {selectedCount}/{enabledPermissions.length}
          </span>
        </div>
        <IndeterminateCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          disabled={enabledPermissions.length === 0}
          aria-label={`Toggle all ${formatGroupLabel(group)} permissions`}
          className={checkboxClassName}
          onChange={(event) => {
            onToggleGroup(event.target.checked);
          }}
        />
      </div>
      <div className="space-y-3">
        {permissions.map((permission) => {
          const disabled = permission.key.startsWith("platform.") || permission.key.includes("*");
          const isChecked = selected.includes(permission.key);

          return (
            <label
              key={permission.key}
              className={[
                "flex items-start gap-3",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                !isChecked && !disabled ? "opacity-70" : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                aria-label={permission.key}
                className={checkboxClassName}
                onChange={() => {
                  onTogglePermission(permission.key);
                }}
              />
              <span className="min-w-0 flex-1">
                <code
                  className={[
                    "inline-block rounded px-1.5 py-0.5 font-mono text-xs",
                    isChecked
                      ? "bg-[var(--admin-primary-container)]/50 text-[var(--admin-primary-strong)]"
                      : "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
                  ].join(" ")}
                >
                  {permission.key}
                </code>
                <span className="mt-1 block text-sm text-[var(--admin-on-surface-variant)]">
                  {permission.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function RoleEditor({ role }: RoleEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groupedPermissions = useMemo(() => buildTenantPermissionGroups(), []);

  const addedPermissions = useMemo(
    () => selected.filter((key) => !role.permissions.includes(key)),
    [role.permissions, selected],
  );

  const protectedRole = role.isSystem && role.key === "owner";
  const roleTypeLabel = role.isSystem ? "System role" : "Custom role";
  const roleDescription = role.isSystem
    ? systemRoleDescription(role.key)
    : "Custom role with tenant-defined permissions.";

  if (protectedRole) {
    return <ProtectedRoleEditor role={role} />;
  }

  function togglePermission(key: string) {
    if (key.startsWith("platform.") || key.includes("*")) return;

    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  }

  function toggleGroupPermissions(group: string, checked: boolean) {
    const groupKeys = (groupedPermissions.find(([name]) => name === group)?.[1] ?? [])
      .map((permission) => permission.key)
      .filter((key) => !key.startsWith("platform.") && !key.includes("*"));

    setSelected((current) => {
      if (checked) {
        return [...new Set([...current, ...groupKeys])];
      }
      return current.filter((key) => !groupKeys.includes(key));
    });
  }

  async function saveRole() {
    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.put(
        `/api/v1/roles/${role.id}`,
        {
          name: name.trim(),
          permissions: selected,
        },
        "role-update",
      );
      router.refresh();
    } catch (error) {
      const message = formatClientError(error);
      setErrorMessage(
        message.toLowerCase().includes("grant")
          ? `${message} The server enforces no-grant-up — you cannot assign permissions you do not hold.`
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole() {
    if (role.isSystem) {
      setErrorMessage("System roles cannot be deleted.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.delete(`/api/v1/roles/${role.id}`, "role-delete");
      router.push("/admin/roles");
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <RoleEditorPageHeader
        title={name.trim() || role.name}
        roleKey={role.key}
        roleTypeLabel={roleTypeLabel}
      />

      {errorMessage ? (
        <p
          role="alert"
          className="mb-8 rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {errorMessage}
        </p>
      ) : null}

      {addedPermissions.length > 0 ? (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 p-4">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <p className="text-sm font-medium leading-relaxed text-[var(--admin-warning)]">
            You are adding {addedPermissions.length} permission(s). Save will fail if any exceed
            your own role (no-grant-up guard).
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8">
        <GeneralDetailsCard>
          <div className="md:col-span-1">
            <label
              htmlFor="role-name"
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface-variant)]"
            >
              Role Name
            </label>
            <input
              id="role-name"
              className={fieldClassName}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <div className="md:col-span-1">
            <label
              htmlFor="role-id"
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface-variant)]"
            >
              Role ID
            </label>
            <input
              id="role-id"
              type="text"
              value={role.id}
              disabled
              className={[lockedFieldClassName, "font-mono text-xs italic"].join(" ")}
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="role-description"
              className="mb-2 block text-sm font-medium text-[var(--admin-on-surface-variant)]"
            >
              Description
            </label>
            <textarea
              id="role-description"
              value={roleDescription}
              disabled
              rows={4}
              className={[lockedFieldClassName, "resize-none"].join(" ")}
            />
          </div>
        </GeneralDetailsCard>

        <section>
          <PermissionCatalogueHeader />
          <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
            Define what this role is allowed to see and manage across the academy platform.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groupedPermissions.map(([group, permissions]) => (
              <EditablePermissionCard
                key={group}
                group={group}
                permissions={permissions}
                selected={selected}
                onToggleGroup={(checked) => {
                  toggleGroupPermissions(group, checked);
                }}
                onTogglePermission={togglePermission}
              />
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-12 flex flex-col gap-4 border-t border-[var(--admin-border)] py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
          <History className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium">
            Last updated {formatRelativeUpdatedAt(role.updatedAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <button
            type="button"
            disabled={busy || role.isSystem}
            onClick={() => {
              setConfirmDelete(true);
            }}
            className="rounded-lg border border-[var(--admin-danger)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete role
          </button>
          <Link
            href="/admin/roles"
            className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void saveRole();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-8 py-2.5 text-sm font-bold text-[var(--admin-bg)] shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this role?"
        description="Members assigned to this role will lose its permissions."
        confirmLabel="Delete role"
        destructive
        busy={busy}
        onConfirm={() => {
          void deleteRole();
        }}
        onCancel={() => {
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
