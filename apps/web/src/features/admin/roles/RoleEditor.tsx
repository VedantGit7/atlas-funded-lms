"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PERMISSIONS } from "@atlas/access/seed/permission-catalogue";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type RoleEditorProps = {
  role: {
    id: string;
    key: string;
    name: string;
    isSystem: boolean;
    permissions: string[];
  };
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function RoleEditor({ role }: RoleEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tenantPermissions = useMemo(
    () =>
      PERMISSIONS.filter((permission) => !permission.platformOnly).map(
        (permission) => permission.key,
      ),
    [],
  );

  const protectedRole = role.isSystem && role.key === "owner";

  function togglePermission(key: string) {
    if (key.startsWith("platform.") || key.includes("*")) return;

    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
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
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole() {
    if (role.isSystem) {
      setErrorMessage("System roles cannot be deleted.");
      return;
    }

    if (!window.confirm("Delete this role?")) return;

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
    <div className="space-y-4">
      {protectedRole ? <p>The owner system role is protected from admin edits.</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}

      <label>
        Name
        <input
          value={name}
          disabled={protectedRole}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>

      <section>
        <h2>Permission catalogue</h2>
        <p>Platform permissions and wildcards are disabled. The server enforces no-grant-up.</p>
        <ul className="columns-2 gap-4">
          {tenantPermissions.map((key) => {
            const disabled = key.startsWith("platform.") || key.includes("*") || protectedRole;
            return (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    disabled={disabled}
                    onChange={() => {
                      togglePermission(key);
                    }}
                  />
                  {key}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex gap-2">
        <button type="button" disabled={busy || protectedRole} onClick={() => void saveRole()}>
          Save role
        </button>
        <button type="button" disabled={busy || role.isSystem} onClick={() => void deleteRole()}>
          Delete role
        </button>
      </div>
    </div>
  );
}
