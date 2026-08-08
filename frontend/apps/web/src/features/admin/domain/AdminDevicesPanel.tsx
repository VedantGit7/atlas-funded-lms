"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  ghostButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { fetchDeviceSessions, type DeviceSession } from "./admin-domain-api";
import { AdminDomainPageShell, adminDomainCardClassName } from "./admin-domain-shared";

export function AdminDevicesPanel() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDeviceSessions();
      setSessions(response.data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load device sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminDomainPageShell
      title="Device Sessions"
      description="Active device sessions captured for security monitoring."
      error={error}
    >
      <section className={adminDomainCardClassName}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Sessions</h2>
          <button type="button" className={ghostButtonClassName} disabled={loading} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">No device sessions recorded.</p>
        ) : (
          <div className={`${analyticsTableShellClassName} mt-4`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Membership</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Platform</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>IP</th>
                  <th className={`${analyticsTableHeadClassName} px-4 py-3`}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className={analyticsTableRowClassName}>
                    <td className="px-4 py-3 font-mono text-xs">{session.membershipId}</td>
                    <td className="px-4 py-3">{session.platform ?? "—"}</td>
                    <td className="px-4 py-3">{session.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3">{new Date(session.lastSeenAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/active-devices"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          View active devices report
        </Link>
        {" · "}
        <Link
          href="/admin/security/device-monitor"
          className="font-semibold text-[var(--admin-primary)] hover:underline"
        >
          Device monitor settings
        </Link>
      </p>
    </AdminDomainPageShell>
  );
}
