"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";
import { loadDeadLetterListAction } from "../../../lib/server/platform-server-actions";
import { platformApi } from "../platform-api";

type DeadLetterRow = {
  id: string;
  tenantId: string | null;
  eventType: string;
  errorCode: string | null;
  safeErrorMessage: string | null;
  failedAt: string;
};

export function DeadLetterEventTable() {
  const { reason, isValid } = usePlatformReason();
  const [rows, setRows] = useState<DeadLetterRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!reason) return;

      setLoading(true);
      setError(null);
      try {
        const response = await loadDeadLetterListAction(reason, {
          limit: 50,
          ...(cursor ? { cursor } : {}),
        });
        setRows((current) => (append ? [...current, ...response.data] : response.data));
        setNextCursor(response.page.nextCursor);
        setHasMore(response.page.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dead letters.");
        if (!append) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [reason],
  );

  useEffect(() => {
    if (!isValid || !reason) return;
    void loadRows();
  }, [isValid, reason, loadRows]);

  async function replayDeadLetter() {
    if (!reason || !selectedId) return;

    setError(null);
    setMessage(null);
    try {
      await platformApi.post(
        `/api/v1/internal/outbox/dead-letter/${selectedId}/replay`,
        { reason: actionReason },
        reason,
        "platform-dead-letter-replay",
      );
      await loadRows();
      // `message` was rendered as a role="status" banner but setMessage was never
      // called, so a successful replay gave the operator no confirmation at all —
      // indistinguishable from nothing having happened. The F7 test asserted only
      // that the identifier `setMessage` appeared in the file, so it passed
      // throughout.
      setMessage(`Replay requested for dead letter ${selectedId}.`);
      setDialogOpen(false);
      setSelectedId(null);
      setActionReason("");
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Replay failed.");
    }
  }

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Eventing / dead-letter ops</h1>
        <p className="text-sm text-muted-foreground">
          Replay uses the approved outbox replay endpoint only. No client-side worker rerun.
        </p>

        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading && rows.length === 0 ? <p>Loading dead letters…</p> : null}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4">Failed at</th>
              <th className="py-2 pr-4">Tenant</th>
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Error</th>
              <th className="py-2">Replay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2 pr-4">{new Date(row.failedAt).toLocaleString()}</td>
                <td className="py-2 pr-4 font-mono text-xs">{row.tenantId?.slice(0, 8) ?? "—"}</td>
                <td className="py-2 pr-4">{row.eventType}</td>
                <td className="py-2 pr-4">{row.safeErrorMessage ?? row.errorCode ?? "—"}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 hover:bg-muted"
                    onClick={() => {
                      setSelectedId(row.id);
                      setActionReason("");
                      setDialogOpen(true);
                    }}
                  >
                    Replay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasMore ? (
          <button
            type="button"
            className="rounded border border-border px-3 py-2 text-sm hover:bg-muted"
            disabled={loading || !nextCursor}
            onClick={() => {
              void loadRows(nextCursor, true);
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </section>

      <PlatformReasonDialog
        open={dialogOpen}
        title="Confirm dead-letter replay"
        description="Replay is idempotent at the outbox layer and requires an operational reason."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          void replayDeadLetter();
        }}
        onCancel={() => {
          setDialogOpen(false);
          setSelectedId(null);
        }}
      />
    </PlatformReasonGate>
  );
}
