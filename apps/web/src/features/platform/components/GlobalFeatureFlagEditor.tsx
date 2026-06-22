"use client";

import { useEffect, useState } from "react";
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

export function GlobalFeatureFlagEditor() {
  const { reason, isValid } = usePlatformReason();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ key: "", defaultValue: "true", description: "" });
  const [actionReason, setActionReason] = useState("");

  useEffect(() => {
    if (!isValid || !reason) {
      return;
    }

    platformApi
      .get<{ data: FlagRow[] }>("/api/v1/platform/feature-flags", reason)
      .then((response) => {
        setFlags(response.data);
      })
      .catch(() => {
        setFlags([]);
      });
  }, [isValid, reason]);

  async function createFlag() {
    if (!reason) {
      return;
    }

    await platformApi.post(
      "/api/v1/platform/feature-flags",
      {
        key: draft.key,
        defaultValue: draft.defaultValue === "true",
        description: draft.description || null,
        rolloutType: "BOOLEAN",
        reason: actionReason,
      },
      reason,
      "platform-flag-create",
    );
    const refreshed = await platformApi.get<{ data: FlagRow[] }>(
      "/api/v1/platform/feature-flags",
      reason,
    );
    setFlags(refreshed.data);
    setDialogOpen(false);
    setActionReason("");
  }

  return (
    <PlatformReasonGate ready={isValid} onPrompt={() => undefined}>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Global feature flags</h1>
          <button
            type="button"
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Create flag
          </button>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Key</th>
              <th className="py-2 pr-4">Default</th>
              <th className="py-2">Rollout</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.id} className="border-b">
                <td className="py-2 pr-4">{flag.key}</td>
                <td className="py-2 pr-4">{String(flag.defaultValue)}</td>
                <td className="py-2">{flag.rolloutType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PlatformReasonDialog
        open={dialogOpen}
        title="Create global feature flag"
        description="Global catalogue changes require an operational reason."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          void createFlag();
        }}
        onCancel={() => {
          setDialogOpen(false);
        }}
      />

      {dialogOpen ? (
        <div className="mt-4 space-y-3 rounded border bg-white p-4">
          <label className="block text-sm">
            Key
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={draft.key}
              onChange={(event) => {
                setDraft((current) => ({ ...current, key: event.target.value }));
              }}
            />
          </label>
          <label className="block text-sm">
            Default value
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={draft.defaultValue}
              onChange={(event) => {
                setDraft((current) => ({ ...current, defaultValue: event.target.value }));
              }}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>
      ) : null}
    </PlatformReasonGate>
  );
}
