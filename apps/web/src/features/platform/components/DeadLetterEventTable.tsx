"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isValid || !reason) {
      return;
    }

    void loadDeadLetterListAction(reason, { limit: 50 })
      .then((response) => {
        setRows(response.data);
      })
      .catch(() => {
        setRows([]);
      });
  }, [isValid, reason]);

  async function replayDeadLetter() {
    if (!reason || !selectedId) {
      return;
    }

    await platformApi.post(
      `/api/v1/internal/outbox/dead-letter/${selectedId}/replay`,
      { reason: actionReason },
      reason,
      "platform-dead-letter-replay",
    );
    const refreshed = await loadDeadLetterListAction(reason, { limit: 50 });
    setRows(refreshed.data);
    setDialogOpen(false);
    setSelectedId(null);
    setActionReason("");
  }

  return (
    <PlatformReasonGate ready={isValid} onPrompt={() => undefined}>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Eventing / dead-letter ops</h1>
        <p className="text-sm opacity-70">
          Replay uses the approved outbox replay endpoint only. No client-side worker rerun.
        </p>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Failed at</th>
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Error</th>
              <th className="py-2">Replay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2 pr-4">{new Date(row.failedAt).toLocaleString()}</td>
                <td className="py-2 pr-4">{row.eventType}</td>
                <td className="py-2 pr-4">{row.safeErrorMessage ?? row.errorCode ?? "—"}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    onClick={() => {
                      setSelectedId(row.id);
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
