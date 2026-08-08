"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  cardClassName,
  cardHeaderClassName,
  roleIcon,
  roleSummary,
} from "./member-detail-shared";

type RoleOption = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

type MemberRoleEditorProps = {
  membershipId: string;
  assignedRoles: RoleOption[];
  availableRoles: RoleOption[];
  isOwnerMember: boolean;
};

const selectClassName =
  "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function MemberRoleEditor({
  membershipId,
  assignedRoles,
  availableRoles,
  isOwnerMember,
}: MemberRoleEditorProps) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = useState(availableRoles[0]?.id ?? "");
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const assignableRoles = availableRoles.filter(
    (role) =>
      !assignedRoles.some((assigned) => assigned.id === role.id) &&
      role.key !== "owner" &&
      !(role.key === "admin" && isOwnerMember),
  );

  async function assignRole() {
    if (!selectedRoleId) return;

    setBusyRoleId(selectedRoleId);
    setErrorMessage(null);

    try {
      await clientApi.post(
        `/api/v1/members/${membershipId}/roles`,
        { roleId: selectedRoleId },
        "member-role-assign",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyRoleId(null);
    }
  }

  async function revokeRole(roleId: string, roleKey: string) {
    if (roleKey === "owner" || isOwnerMember) {
      setErrorMessage("This role assignment cannot be changed from the admin console.");
      return;
    }

    setBusyRoleId(roleId);
    setErrorMessage(null);

    try {
      await clientApi.delete(
        `/api/v1/members/${membershipId}/roles/${roleId}`,
        "member-role-revoke",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyRoleId(null);
    }
  }

  return (
    <section id="member-roles" className={cardClassName}>
      <div className={cardHeaderClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Assigned Roles</h2>
        {!isOwnerMember && assignableRoles.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setManageOpen((current) => !current);
            }}
            className="text-sm font-medium text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)] hover:underline"
            aria-expanded={manageOpen}
          >
            {manageOpen ? "Hide" : "Manage roles"}
          </button>
        ) : null}
      </div>

      <div className="space-y-4 p-6">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
          >
            {errorMessage}
          </p>
        ) : null}

        {assignedRoles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {assignedRoles.map((role) => {
              const Icon = roleIcon(role.key);
              const revokeLocked = role.key === "owner" || isOwnerMember || busyRoleId === role.id;

              return (
                <div
                  key={role.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 py-2"
                >
                  <Icon
                    className={[
                      "h-4 w-4",
                      role.key === "owner"
                        ? "fill-[var(--admin-primary)] text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface-variant)]",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                    {role.name}
                  </span>
                  {role.isSystem ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      system
                    </span>
                  ) : null}
                  {!revokeLocked ? (
                    <button
                      type="button"
                      aria-label={`Revoke ${role.name}`}
                      disabled={busyRoleId != null}
                      onClick={() => {
                        void revokeRole(role.id, role.key);
                      }}
                      className="ml-1 rounded-full p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] hover:text-[var(--admin-danger)] disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">No roles assigned yet.</p>
        )}

        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {roleSummary(assignedRoles)}
        </p>

        {manageOpen && assignableRoles.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center">
            <select
              value={selectedRoleId}
              onChange={(event) => {
                setSelectedRoleId(event.target.value);
              }}
              className={`${selectClassName} min-w-0 flex-1`}
            >
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedRoleId || busyRoleId != null}
              onClick={() => {
                void assignRole();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Assign role
            </button>
          </div>
        ) : null}

        {!isOwnerMember && assignableRoles.length === 0 && assignedRoles.length > 0 ? (
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            No additional roles available to assign.
          </p>
        ) : null}
      </div>
    </section>
  );
}
