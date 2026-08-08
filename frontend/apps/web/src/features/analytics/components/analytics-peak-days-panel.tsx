"use client";

import { Download } from "lucide-react";
import type { TrendPoint } from "../analytics-studio-shared";
import { panelHeaderClassName, recessedPanelClassName } from "../analytics-studio-shared";

type AnalyticsPeakDaysPanelProps = {
  days: TrendPoint[];
  onExport?: (() => void) | undefined;
  loading?: boolean | undefined;
};

export function AnalyticsPeakDaysPanel({
  days,
  onExport,
  loading = false,
}: AnalyticsPeakDaysPanelProps) {
  return (
    <section className={recessedPanelClassName} aria-labelledby="peak-days-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="peak-days-heading" className={panelHeaderClassName}>
          Peak days
        </h2>
        <button
          type="button"
          className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
          aria-label="Export peak day volumes as CSV"
          disabled={!onExport || days.length === 0}
          onClick={onExport}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
            Loading…
          </p>
        ) : days.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
            Submission volume by day will appear once learners submit assessments.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-left">
                <th
                  scope="col"
                  className="py-2 text-[10px] font-bold uppercase tracking-tight text-[var(--admin-on-surface-variant)]"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="py-2 text-right text-[10px] font-bold uppercase tracking-tight text-[var(--admin-on-surface-variant)]"
                >
                  Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr
                  key={day.sortKey}
                  className="transition-colors hover:bg-[var(--admin-surface-container,_var(--admin-surface-high))]"
                >
                  <td className="py-2 font-medium text-[var(--admin-on-surface)]">{day.label}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--admin-on-surface)]">
                    {day.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-[11px] text-[var(--admin-on-surface-variant)]">
        Highest-volume days in the selected range (not hourly slots — daily rollups only).
      </p>
    </section>
  );
}
