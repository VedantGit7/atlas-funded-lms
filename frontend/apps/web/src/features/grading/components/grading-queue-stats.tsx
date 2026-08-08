"use client";

import type { GradingQueueItem } from "../api";
import { computeQueueStats, statCardClassName, statLabelClassName } from "../grading-studio-shared";

type GradingQueueStatsProps = {
  tasks: GradingQueueItem[];
};

export function GradingQueueStats({ tasks }: GradingQueueStatsProps) {
  const stats = computeQueueStats(tasks);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className={statCardClassName}>
        <span className={statLabelClassName}>Needs attention</span>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-2xl font-bold text-[var(--admin-on-surface)]">
            {String(stats.actionable)}
          </span>
          <span className="text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
            {stats.pending} pending · {stats.inProgress} in progress
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
            style={{
              width:
                stats.total > 0
                  ? `${Math.max(8, 100 - (stats.actionable / stats.total) * 100)}%`
                  : "0%",
            }}
          />
        </div>
      </div>

      <div className={statCardClassName}>
        <span className={statLabelClassName}>Queue completion</span>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-2xl font-bold text-[var(--admin-on-surface)]">
            {stats.completionRate != null ? `${String(stats.completionRate)}%` : "—"}
          </span>
          <span className="text-[11px] font-semibold text-[var(--admin-success)]">
            {stats.total > 0 ? `${String(stats.graded)} graded` : "No tasks loaded"}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-[var(--admin-on-surface-variant)]">
          {stats.total > 0
            ? "Based on tasks currently loaded in your queue."
            : "Completion is shown once at least one task is in your queue."}
        </p>
      </div>

      <div className={statCardClassName}>
        <span className={statLabelClassName}>Priority pending</span>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-2xl font-bold text-[var(--admin-on-surface)]">
            {String(stats.urgent)}
          </span>
          <span className="text-[11px] font-semibold text-[var(--admin-warning)]">
            {stats.urgent > 0 ? "Over 24h old" : stats.total > 0 ? "Queue healthy" : "Nothing waiting"}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-[var(--admin-on-surface-variant)]">
          Pending submissions waiting more than a day for review.
        </p>
      </div>

      <div
        className={`${statCardClassName} border-l-4 border-l-[var(--admin-warning)]`}
      >
        <span className={`${statLabelClassName} text-[var(--admin-warning)]`}>Total loaded</span>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-2xl font-bold text-[var(--admin-on-surface)]">
            {String(stats.total)}
          </span>
          <span className="text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
            Assigned to you
          </span>
        </div>
        <p className="mt-3 text-[11px] text-[var(--admin-on-surface-variant)]">
          Filter or search below to narrow this list.
        </p>
      </div>
    </div>
  );
}
