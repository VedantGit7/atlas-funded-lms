"use client";

import { useState } from "react";

type AuditEntryItem = {
  id: string;
  occurredAt: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorMembershipId: string | null;
  requestId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
};

type AuditLogViewerProps = {
  entries: AuditEntryItem[];
};

export function AuditLogViewer({ entries }: AuditLogViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  return (
    <section className="space-y-4">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Tenant audit log</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-4">
              When
            </th>
            <th scope="col" className="py-2 pr-4">
              Action
            </th>
            <th scope="col" className="py-2 pr-4">
              Target
            </th>
            <th scope="col" className="py-2">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b">
              <td className="py-3 pr-4">{new Date(entry.occurredAt).toLocaleString()}</td>
              <td className="py-3 pr-4">{entry.action}</td>
              <td className="py-3 pr-4">
                {entry.targetType}
                {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""}
              </td>
              <td className="py-3">
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  aria-expanded={selectedId === entry.id}
                  onClick={() => {
                    setSelectedId(entry.id === selectedId ? null : entry.id);
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
        <aside
          aria-label="Audit entry details"
          className="rounded border bg-white p-4 text-sm shadow-sm"
        >
          <h2 className="font-medium">Audit entry</h2>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="opacity-70">Action</dt>
              <dd>{selected.action}</dd>
            </div>
            <div>
              <dt className="opacity-70">Target</dt>
              <dd>
                {selected.targetType}
                {selected.targetId ? ` (${selected.targetId})` : ""}
              </dd>
            </div>
            <div>
              <dt className="opacity-70">Request ID</dt>
              <dd>{selected.requestId}</dd>
            </div>
            {selected.reason ? (
              <div>
                <dt className="opacity-70">Reason</dt>
                <dd>{selected.reason}</dd>
              </div>
            ) : null}
            {selected.metadata ? (
              <div>
                <dt className="opacity-70">Metadata</dt>
                <dd>
                  <pre className="overflow-x-auto rounded bg-neutral-50 p-2 font-mono text-xs">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      ) : null}
    </section>
  );
}
