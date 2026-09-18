"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Video } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type ZoomMeeting = {
  id: string;
  externalMeetingId: string;
  topic: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

function formatWhen(value: string | null): string {
  return value === null ? "—" : new Date(value).toLocaleString();
}

function durationLabel(startedAt: string | null, endedAt: string | null): string {
  if (startedAt === null || endedAt === null) return "—";
  const minutes = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
  );
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${String(minutes)} min`;
  return `${String(Math.floor(minutes / 60))}h ${String(minutes % 60)}m`;
}

/**
 * Meetings synced from the connected Zoom account.
 *
 * `GET /api/v1/zoom/meetings` had no caller, so once a tenant connected Zoom
 * there was no way to confirm anything was actually arriving — the webhook
 * writes meetings and participant counts, and the only visible signal was
 * attendance rows appearing (or not) in a report much later. Listing the raw
 * synced meetings is what makes "is the connection working?" answerable.
 */
export function ZoomMeetingsPanel() {
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<{ data: { items: ZoomMeeting[] } }>(
        "/api/v1/zoom/meetings",
      );
      setMeetings(response.data.items);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not load meetings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
            <Video className="h-4 w-4" aria-hidden="true" />
            Synced meetings
          </h3>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Meetings Zoom has reported to this tenant, newest first.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-60"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">Loading meetings…</p>
      ) : meetings.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-on-surface-variant)]">
          No meetings synced yet. They appear here once Zoom sends its first webhook for this
          account.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                <th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">Meeting ID</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2 text-[var(--admin-on-surface)]">
                    {meeting.topic ?? "Untitled meeting"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    {meeting.externalMeetingId}
                  </td>
                  <td className="px-3 py-2 text-[var(--admin-on-surface-variant)]">
                    {formatWhen(meeting.startedAt)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[var(--admin-on-surface-variant)]">
                    {durationLabel(meeting.startedAt, meeting.endedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
