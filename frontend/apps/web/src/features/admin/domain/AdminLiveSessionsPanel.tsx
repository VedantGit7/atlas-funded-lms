"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  createLiveSession,
  fetchLiveAttendance,
  fetchLiveSessions,
  type LiveSession,
} from "./admin-domain-api";
import { AdminDomainPageShell, adminDomainCardClassName } from "./admin-domain-shared";

export function AdminLiveSessionsPanel() {
  const [sessions, setSessions] = useState<Array<LiveSession & { attendanceCount?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveSessions();
      const withCounts = await Promise.all(
        response.data.items.map(async (session) => {
          try {
            const attendance = await fetchLiveAttendance(session.id);
            return { ...session, attendanceCount: attendance.data.items.length };
          } catch {
            return { ...session, attendanceCount: 0 };
          }
        }),
      );
      setSessions(withCounts);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createLiveSession({
        title: title.trim(),
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
      setTitle("");
      setScheduledAt("");
      await load();
    } catch (createError) {
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminDomainPageShell
      title="Live Sessions"
      description="Schedule live classes and monitor attendance counts."
      error={error}
    >
      <div className={adminDomainCardClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Create session</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Title
            </span>
            <input
              className={fieldClassName}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
              Scheduled at
            </span>
            <input
              type="datetime-local"
              className={fieldClassName}
              value={scheduledAt}
              onChange={(e) => {
                setScheduledAt(e.target.value);
              }}
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={primaryButtonClassName} disabled={submitting}>
              {submitting ? "Creating…" : "Create session"}
            </button>
          </div>
        </form>
      </div>

      <section className={adminDomainCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Sessions</h2>
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
            No live sessions yet.
          </p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Title</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Status</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Scheduled</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3">{session.title}</td>
                    <td className="px-4 py-3 capitalize">{session.status}</td>
                    <td className="px-4 py-3">
                      {session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{session.attendanceCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/live-class-attendance"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          View live class attendance report
        </Link>
      </p>
    </AdminDomainPageShell>
  );
}
