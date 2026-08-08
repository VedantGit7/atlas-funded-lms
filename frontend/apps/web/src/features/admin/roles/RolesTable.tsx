"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";

export type RoleRow = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

type RolesTableProps = {
  roles: RoleRow[];
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function RoleTypeBadge({ isSystem }: { isSystem: boolean }) {
  if (isSystem) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-on-surface-variant)]">
        System role
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-[var(--admin-primary-container)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-on-primary-container)]">
      Custom role
    </span>
  );
}

export function RolesTable({ roles }: RolesTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);

  const sortedRoles = useMemo(
    () => [...roles].sort((left, right) => left.name.localeCompare(right.name)),
    [roles],
  );

  async function deleteRole(role: RoleRow) {
    if (role.isSystem) {
      setErrorMessage("System roles cannot be deleted.");
      return;
    }

    setBusyId(role.id);
    setErrorMessage(null);

    try {
      await clientApi.delete(`/api/v1/roles/${role.id}`, "role-delete");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  if (roles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
        <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No roles yet</p>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
          Create a custom role to define permissions for your team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <p role="alert" className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <th className="w-1/2 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Role
              </th>
              <th className="w-1/5 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Type
              </th>
              <th className="w-[30%] px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {sortedRoles.map((role) => {
              const deleteLocked = role.isSystem || role.key === "owner";

              return (
                <tr
                  key={role.id}
                  className="transition-colors hover:bg-[var(--admin-surface-low)]/70"
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <Link
                        href={`/admin/roles/${role.id}`}
                        className="text-[15px] font-semibold text-[var(--admin-primary)] underline-offset-4 hover:underline"
                      >
                        {role.name}
                      </Link>
                      <code className="mt-1 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {role.key}
                      </code>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <RoleTypeBadge isSystem={role.isSystem} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/roles/${role.id}`}
                        className="text-sm font-semibold text-[var(--admin-primary)] transition-opacity hover:opacity-70"
                      >
                        Edit
                      </Link>
                      {deleteLocked ? (
                        <button
                          type="button"
                          disabled
                          title="System roles cannot be deleted"
                          className="inline-flex cursor-not-allowed items-center gap-1 text-sm font-semibold text-[var(--admin-danger)] opacity-40"
                        >
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === role.id}
                          onClick={() => {
                            setDeleteTarget(role);
                          }}
                          className="text-sm font-semibold text-[var(--admin-danger)] transition-opacity hover:opacity-70 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete custom role?"
        description={`Remove role "${deleteTarget?.name ?? ""}" from the tenant catalogue. Members assigned this role will lose it.`}
        confirmLabel="Delete role"
        destructive
        busy={busyId != null}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteRole(deleteTarget);
          }
        }}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
