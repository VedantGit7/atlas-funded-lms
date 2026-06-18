"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type PermissionOverridePanelProps = {
  membershipId: string;
  overrides: Array<{
    id: string;
    permissionKey: string;
    effect: "ALLOW" | "DENY";
    reason: string | null;
  }>;
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function PermissionOverridePanel({ membershipId, overrides }: PermissionOverridePanelProps) {
  const router = useRouter();
  const [permissionKey, setPermissionKey] = useState("profile.read");
  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createOverride() {
    setBusyId("create");
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/permission-overrides",
        {
          membershipId,
          permissionKey,
          effect,
          reason: reason.trim() || null,
        },
        "permission-override-create",
      );
      setReason("");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOverride(overrideId: string) {
    setBusyId(overrideId);
    setErrorMessage(null);

    try {
      await clientApi.delete(
        `/api/v1/permission-overrides/${overrideId}`,
        "permission-override-delete",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2>Permission overrides</h2>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}

      <ul>
        {overrides.map((override) => (
          <li key={override.id} className="flex items-center gap-2">
            <span>
              {override.permissionKey} — {override.effect}
              {override.reason ? ` (${override.reason})` : ""}
            </span>
            <button
              type="button"
              disabled={busyId === override.id}
              onClick={() => void deleteOverride(override.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void createOverride();
        }}
      >
        <label>
          Permission key
          <input
            value={permissionKey}
            onChange={(event) => {
              setPermissionKey(event.target.value);
            }}
          />
        </label>
        <label>
          Effect
          <select
            value={effect}
            onChange={(event) => {
              setEffect(event.target.value as "ALLOW" | "DENY");
            }}
          >
            <option value="ALLOW">ALLOW</option>
            <option value="DENY">DENY</option>
          </select>
        </label>
        <label>
          Reason
          <input
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </label>
        <button type="submit" disabled={busyId === "create"}>
          Create override
        </button>
      </form>
    </section>
  );
}
