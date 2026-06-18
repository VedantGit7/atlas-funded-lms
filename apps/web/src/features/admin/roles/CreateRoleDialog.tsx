"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function CreateRoleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState("profile.read,membership.read");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitRole() {
    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/roles",
        {
          key: key.trim(),
          name: name.trim(),
          permissions: permissions
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
        "role-create",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {open ? "Close create role" : "Create role"}
      </button>

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitRole();
          }}
        >
          <label>
            Key
            <input
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
              }}
              required
            />
          </label>
          <label>
            Name
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              required
            />
          </label>
          <label>
            Permissions (comma-separated)
            <input
              value={permissions}
              onChange={(event) => {
                setPermissions(event.target.value);
              }}
            />
          </label>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
          <button type="submit" disabled={busy}>
            Create
          </button>
        </form>
      ) : null}
    </div>
  );
}
