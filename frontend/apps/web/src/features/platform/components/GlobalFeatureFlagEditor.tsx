"use client";

import { useCallback, useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";

type FlagRow = {
  id: string;
  key: string;
  defaultValue: unknown;
  description: string | null;
  rolloutType: string;
};

type DialogMode = "create" | "update";

function formatDefaultValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseDefaultValue(raw: string, rolloutType: string): unknown {
  if (rolloutType === "BOOLEAN") {
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  if (raw.startsWith("{") || raw.startsWith("[")) {
    return JSON.parse(raw) as unknown;
  }
  return raw;
}

export function GlobalFeatureFlagEditor() {
  const { reason, isValid } = usePlatformReason();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [formMode, setFormMode] = useState<DialogMode | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FlagRow | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [draft, setDraft] = useState({
    key: "",
    defaultValue: "true",
    description: "",
    rolloutType: "BOOLEAN" as "BOOLEAN" | "JSON",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFlags = useCallback(async () => {
    if (!reason) return;
    const response = await platformApi.get<{ data: FlagRow[] }>(
      "/api/v1/platform/feature-flags",
      reason,
    );
    setFlags(response.data);
  }, [reason]);

  useEffect(() => {
    if (!isValid || !reason) return;
    void loadFlags().catch(() => {
      setFlags([]);
    });
  }, [isValid, reason, loadFlags]);

  function openCreateDialog() {
    setEditTarget(null);
    setDraft({ key: "", defaultValue: "true", description: "", rolloutType: "BOOLEAN" });
    setFormMode("create");
  }

  function openUpdateDialog(flag: FlagRow) {
    setEditTarget(flag);
    setDraft({
      key: flag.key,
      defaultValue: formatDefaultValue(flag.defaultValue),
      description: flag.description ?? "",
      rolloutType: flag.rolloutType === "JSON" ? "JSON" : "BOOLEAN",
    });
    setFormMode("update");
  }

  function closeDialogs() {
    setFormMode(null);
    setReasonDialogOpen(false);
    setEditTarget(null);
    setActionReason("");
  }

  async function saveFlag() {
    if (!reason || !formMode) return;

    setBusy(true);
    setError(null);

    try {
      const defaultValue = parseDefaultValue(draft.defaultValue, draft.rolloutType);

      if (formMode === "create") {
        await platformApi.post(
          "/api/v1/platform/feature-flags",
          {
            key: draft.key,
            defaultValue,
            description: draft.description || null,
            rolloutType: draft.rolloutType,
            reason: actionReason,
          },
          reason,
          "platform-flag-create",
        );
      } else if (editTarget) {
        await platformApi.put(
          `/api/v1/platform/feature-flags/${encodeURIComponent(editTarget.key)}`,
          {
            defaultValue,
            description: draft.description || null,
            rolloutType: draft.rolloutType,
            reason: actionReason,
          },
          reason,
          "platform-flag-update",
        );
      }

      await loadFlags();
      closeDialogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Global feature flags</h1>
            <p className="text-sm text-muted-foreground">
              Manage the global flag catalogue and default values.
            </p>
          </div>
          <button
            type="button"
            className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
            onClick={openCreateDialog}
          >
            Create flag
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Global feature flags</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4">Key</th>
              <th className="py-2 pr-4">Default</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4">Rollout</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.id} className="border-b border-border">
                <td className="py-2 pr-4 font-mono">{flag.key}</td>
                <td className="py-2 pr-4">{formatDefaultValue(flag.defaultValue)}</td>
                <td className="py-2 pr-4">{flag.description ?? "—"}</td>
                <td className="py-2 pr-4">{flag.rolloutType}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() => {
                      openUpdateDialog(flag);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No global flags in catalogue.</p>
        ) : null}
      </section>

      {formMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg">
            <h2 className="text-lg font-semibold">
              {formMode === "create" ? "Create global feature flag" : "Update global feature flag"}
            </h2>
            <div className="mt-4 space-y-3">
              {formMode === "create" ? (
                <label className="block text-sm">
                  Key
                  <input
                    className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2 font-mono"
                    value={draft.key}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, key: event.target.value }));
                    }}
                  />
                </label>
              ) : (
                <p className="text-sm font-mono">{draft.key}</p>
              )}
              <label className="block text-sm">
                Rollout type
                <select
                  className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
                  value={draft.rolloutType}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      rolloutType: event.target.value as "BOOLEAN" | "JSON",
                    }));
                  }}
                >
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="JSON">JSON</option>
                </select>
              </label>
              <label className="block text-sm">
                Default value
                {draft.rolloutType === "BOOLEAN" ? (
                  <select
                    className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
                    value={draft.defaultValue}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, defaultValue: event.target.value }));
                    }}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <textarea
                    className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2 font-mono"
                    rows={3}
                    value={draft.defaultValue}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, defaultValue: event.target.value }));
                    }}
                  />
                )}
              </label>
              <label className="block text-sm">
                Description
                <input
                  className="mt-1 w-full rounded border border-input bg-background text-foreground px-3 py-2"
                  value={draft.description}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, description: event.target.value }));
                  }}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={closeDialogs}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={formMode === "create" && !draft.key.trim()}
                onClick={() => {
                  setActionReason("");
                  setReasonDialogOpen(true);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PlatformReasonDialog
        open={reasonDialogOpen}
        title={formMode === "create" ? "Confirm flag creation" : "Confirm flag update"}
        description="Global catalogue changes require an operational reason of at least 10 characters."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          void saveFlag();
        }}
        onCancel={() => {
          if (!busy) {
            setReasonDialogOpen(false);
          }
        }}
      />
    </PlatformReasonGate>
  );
}
