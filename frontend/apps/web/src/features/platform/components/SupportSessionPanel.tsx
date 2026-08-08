"use client";

import { useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonDialog, PlatformReasonGate } from "./PlatformReasonDialog";
import { loadActiveSupportSessionsAction } from "../../../lib/server/platform-server-actions";

type SupportSession = {
  sessionId: string;
  tenantId: string;
  tenantSlug: string;
  tenantDisplayName: string;
  expiresAt: string;
};

export function SupportSessionPanel() {
  const { reason, isValid } = usePlatformReason();
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValid || !reason) {
      return;
    }

    void loadActiveSupportSessionsAction(reason)
      .then((response) => {
        setSessions(response.data);
      })
      .catch(() => {
        setSessions([]);
      });
  }, [isValid, reason]);

  async function openSession() {
    if (!reason) {
      return;
    }

    setError(null);
    try {
      await platformApi.post(
        "/api/v1/platform/support/sessions",
        { tenantId, reason: actionReason },
        reason,
        "platform-support-open",
      );
      const refreshed = await loadActiveSupportSessionsAction(reason);
      setSessions(refreshed.data);
      setDialogOpen(false);
      setActionReason("");
      setTenantId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open support session.");
    }
  }

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Support sessions</h1>
        <p className="text-sm opacity-70">
          Reason-bound, time-boxed read-biased tenant scope. No tenant application link or
          cross-tenant standing access.
        </p>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setDialogOpen(true);
          }}
        >
          <label className="block text-sm">
            Target tenant ID
            <input
              className="mt-1 rounded border px-3 py-2"
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
              }}
              required
            />
          </label>
          <button type="submit" className="rounded bg-neutral-900 px-3 py-2 text-sm text-white">
            Open support session
          </button>
        </form>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Tenant</th>
              <th className="py-2 pr-4">Session</th>
              <th className="py-2">Expires</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.sessionId} className="border-b">
                <td className="py-2 pr-4">
                  {session.tenantDisplayName}
                  <div className="text-xs opacity-70">{session.tenantSlug}</div>
                </td>
                <td className="py-2 pr-4">{session.sessionId.slice(0, 8)}</td>
                <td className="py-2">{new Date(session.expiresAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PlatformReasonDialog
        open={dialogOpen}
        title="Open support session"
        description="Support session entry requires an incident reason of at least 10 characters."
        value={actionReason}
        onChange={setActionReason}
        onConfirm={() => {
          void openSession();
        }}
        onCancel={() => {
          setDialogOpen(false);
        }}
      />
    </PlatformReasonGate>
  );
}
