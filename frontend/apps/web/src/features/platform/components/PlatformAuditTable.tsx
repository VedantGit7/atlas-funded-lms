"use client";

import { useCallback, useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonGate } from "./PlatformReasonDialog";

type AuditEntry = {
  id: string;
  occurredAt: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorMembershipId: string | null;
  platformPrincipalId: string | null;
  requestId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
};

function isScopeTransition(entry: AuditEntry): boolean {
  return (
    entry.action.includes("platform.scope") ||
    entry.action.includes("scope.enter") ||
    entry.action.includes("scope.exit")
  );
}

export function PlatformAuditTable() {
  const { reason, isValid } = usePlatformReason();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAudit = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!reason) return;

      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (targetTypeFilter.trim()) params.set("targetType", targetTypeFilter.trim());
      if (cursor) params.set("cursor", cursor);

      try {
        const response = await platformApi.get<{
          data: AuditEntry[];
          page: { nextCursor: string | null; hasMore: boolean };
        }>(`/api/v1/platform/audit?${params.toString()}`, reason);

        setEntries((current) => (append ? [...current, ...response.data] : response.data));
        setNextCursor(response.page.nextCursor);
        setHasMore(response.page.hasMore);
      } catch {
        if (!append) setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [reason, actionFilter, targetTypeFilter],
  );

  useEffect(() => {
    if (!isValid || !reason) return;
    void loadAudit();
  }, [isValid, reason, loadAudit]);

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Platform audit</h1>

        <div className="flex flex-wrap gap-4">
          <label className="block max-w-md text-sm">
            <span className="font-medium">Filter by action</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2 font-mono"
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
              }}
              placeholder="e.g. tenant.created"
            />
          </label>
          <label className="block max-w-md text-sm">
            <span className="font-medium">Filter by target type</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2 font-mono"
              value={targetTypeFilter}
              onChange={(event) => {
                setTargetTypeFilter(event.target.value);
              }}
              placeholder="e.g. tenant"
            />
          </label>
        </div>

        {loading && entries.length === 0 ? <p>Loading audit entries…</p> : null}

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
              <tr
                key={entry.id}
                className={`border-b ${isScopeTransition(entry) ? "bg-amber-50" : ""}`}
              >
                <td className="py-2 pr-4">{new Date(entry.occurredAt).toLocaleString()}</td>
                <td className="py-2 pr-4 font-mono text-xs">{entry.action}</td>
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

        {hasMore ? (
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            disabled={loading || !nextCursor}
            onClick={() => {
              void loadAudit(nextCursor, true);
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}

        {selected ? (
          <aside className="rounded border bg-white p-4 text-sm" aria-label="Audit entry details">
            <h2 className="font-medium">Audit entry</h2>
            <dl className="mt-2 grid gap-2">
              <div>
                <dt className="opacity-70">Action</dt>
                <dd className="font-mono text-xs">{selected.action}</dd>
              </div>
              <div>
                <dt className="opacity-70">Reason</dt>
                <dd>{selected.reason ?? "—"}</dd>
              </div>
              <div>
                <dt className="opacity-70">Request ID</dt>
                <dd className="font-mono text-xs">{selected.requestId}</dd>
              </div>
              <div>
                <dt className="opacity-70">Actor membership</dt>
                <dd className="font-mono text-xs">{selected.actorMembershipId ?? "—"}</dd>
              </div>
              <div>
                <dt className="opacity-70">Platform principal</dt>
                <dd className="font-mono text-xs">{selected.platformPrincipalId ?? "—"}</dd>
              </div>
              {selected.metadata && Object.keys(selected.metadata).length > 0 ? (
                <div>
                  <dt className="opacity-70">Metadata</dt>
                  <dd>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        ) : null}
      </section>
    </PlatformReasonGate>
  );
}
