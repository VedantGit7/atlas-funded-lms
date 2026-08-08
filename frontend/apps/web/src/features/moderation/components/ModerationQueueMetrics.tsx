"use client";

import {
  moderationMetricCardClassName,
  moderationMetricLabelClassName,
  moderationPageTitleClassName,
} from "../moderation-admin-shared";

type ModerationQueueMetricsProps = {
  openCount: number;
  reviewingCount: number;
  actionedCount: number;
  visibleCount: number;
};

function MetricBar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
      aria-hidden="true"
    >
      <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function ModerationQueueMetrics({
  openCount,
  reviewingCount,
  actionedCount,
  visibleCount,
}: ModerationQueueMetricsProps) {
  const max = Math.max(openCount, reviewingCount, actionedCount, visibleCount, 1);

  return (
    <section aria-label="Queue summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article className={moderationMetricCardClassName}>
        <p className={moderationMetricLabelClassName}>Open cases</p>
        <p className={`${moderationPageTitleClassName} mt-1 text-[var(--admin-on-surface)]`}>
          {openCount}
        </p>
        <MetricBar value={openCount} max={max} tone="bg-[var(--admin-warning)]" />
      </article>
      <article className={moderationMetricCardClassName}>
        <p className={moderationMetricLabelClassName}>In review</p>
        <p className={`${moderationPageTitleClassName} mt-1 text-[var(--admin-warning)]`}>
          {reviewingCount}
        </p>
        <MetricBar value={reviewingCount} max={max} tone="bg-[var(--admin-warning)]" />
      </article>
      <article className={moderationMetricCardClassName}>
        <p className={moderationMetricLabelClassName}>Actioned</p>
        <p className={`${moderationPageTitleClassName} mt-1 text-[var(--admin-danger)]`}>
          {actionedCount}
        </p>
        <MetricBar value={actionedCount} max={max} tone="bg-[var(--admin-danger)]" />
      </article>
      <article className={moderationMetricCardClassName}>
        <p className={moderationMetricLabelClassName}>In current view</p>
        <p className={`${moderationPageTitleClassName} mt-1 text-[var(--admin-primary)]`}>
          {visibleCount}
        </p>
        <MetricBar value={visibleCount} max={max} tone="bg-[var(--admin-primary)]" />
      </article>
    </section>
  );
}
