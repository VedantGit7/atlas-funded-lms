"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AnalyticsDashboardDrillDownResponse } from "@atlas/domain/analytics/analytics.contract";
import { fetchDashboardDrillDown } from "../api";
import { formatDisplayDate, formatRollupLabel } from "../analytics-admin-utils";

type AnalyticsDrillDownDialogProps = {
  open: boolean;
  rollupKey: string;
  day: string;
  label?: string;
  onClose: () => void;
};

export function AnalyticsDrillDownDialog({
  open,
  rollupKey,
  day,
  label,
  onClose,
}: AnalyticsDrillDownDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsDashboardDrillDownResponse["data"] | null>(null);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchDashboardDrillDown({ rollupKey, day, limit: 50 })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load drill-down.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [day, open, rollupKey]);

  if (!open) return null;

  const heading = label ?? formatRollupLabel(rollupKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-drill-down-title"
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id="analytics-drill-down-title" className="text-lg font-semibold text-[var(--admin-on-surface)]">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Members on {formatDisplayDate(day)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close drill-down"
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading members…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          ) : data && data.members.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No members recorded for this metric on the selected day.
            </p>
          ) : data ? (
            <>
              <ul className="divide-y divide-[var(--admin-border)]">
                {data.members.map((member) => (
                  <li key={member.membershipId} className="py-2.5 text-sm text-[var(--admin-on-surface)]">
                    {member.displayName}
                  </li>
                ))}
              </ul>
              {data.capped ? (
                <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
                  Showing the first {data.members.length} members. Export CSV for the full list.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
