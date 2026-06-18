"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function RolesTable({ roles }: RolesTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function deleteRole(roleId: string, isSystem: boolean) {
    if (isSystem) {
      setErrorMessage("System roles cannot be deleted.");
      return;
    }

    if (!window.confirm("Delete this custom role?")) return;

    setBusyId(roleId);
    setErrorMessage(null);

    try {
      await clientApi.delete(`/api/v1/roles/${roleId}`, "role-delete");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  if (roles.length === 0) {
    return <p>No roles found.</p>;
  }

  return (
    <div className="space-y-4">
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td>
                <Link href={`/admin/roles/${role.id}`}>{role.name}</Link>
                <div>{role.key}</div>
              </td>
              <td>{role.isSystem ? "System" : "Custom"}</td>
              <td className="space-x-2">
                <Link href={`/admin/roles/${role.id}`}>Edit</Link>
                <button
                  type="button"
                  disabled={busyId === role.id || role.isSystem || role.key === "owner"}
                  onClick={() => void deleteRole(role.id, role.isSystem)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
