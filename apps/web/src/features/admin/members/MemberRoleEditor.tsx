"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

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
    <section className="space-y-3">
      <h2>Roles</h2>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}

      <ul>
        {assignedRoles.map((role) => (
          <li key={role.id} className="flex items-center gap-2">
            <span>
              {role.name} ({role.key}){role.isSystem ? " — system" : " — custom"}
            </span>
            <button
              type="button"
              disabled={busyRoleId === role.id || role.key === "owner" || isOwnerMember}
              onClick={() => void revokeRole(role.id, role.key)}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>

      {assignableRoles.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={selectedRoleId}
            onChange={(event) => {
              setSelectedRoleId(event.target.value);
            }}
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
            onClick={() => void assignRole()}
          >
            Assign role
          </button>
        </div>
      ) : (
        <p>No additional roles available to assign.</p>
      )}
    </section>
  );
}
