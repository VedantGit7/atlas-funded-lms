"use client";

import { useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonGate } from "./PlatformReasonDialog";

type AuditEntry = {
  id: string;
  occurredAt: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
};

export function PlatformAuditTable() {
  const { reason, isValid } = usePlatformReason();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => {
    if (!isValid || !reason) {
      return;
    }

    platformApi
      .get<{ data: AuditEntry[] }>("/api/v1/platform/audit?limit=50", reason)
      .then((response) => {
        setEntries(response.data);
      })
      .catch(() => {
        setEntries([]);
      });
  }, [isValid, reason]);

  return (
    <PlatformReasonGate ready={isValid} onPrompt={() => undefined}>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Platform audit</h1>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Target</th>
              <th className="py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b">
                <td className="py-2 pr-4">{new Date(entry.occurredAt).toLocaleString()}</td>
                <td className="py-2 pr-4">{entry.action}</td>
                <td className="py-2 pr-4">
                  {entry.targetType}
                  {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={() => {
                      setSelected(entry);
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected ? (
          <aside className="rounded border bg-white p-4 text-sm" aria-label="Audit entry details">
            <h2 className="font-medium">Audit entry</h2>
            <p className="mt-2">Action: {selected.action}</p>
            <p>Reason: {selected.reason ?? "—"}</p>
          </aside>
        ) : null}
      </section>
    </PlatformReasonGate>
  );
}
