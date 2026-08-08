"use client";

import { ArrowDown, Info } from "lucide-react";
import type { FunnelStageView } from "../analytics-admin-utils";
import {
  analyticsFunnelPanelClassName,
  analyticsInsightBannerClassName,
} from "../analytics-admin-shared";

type AnalyticsAdminFunnelProps = {
  stages: FunnelStageView[];
  insight: { from: string; to: string } | null;
};

export function AnalyticsAdminFunnel({ stages, insight }: AnalyticsAdminFunnelProps) {
  if (stages.length === 0) return null;

  return (
    <section className={analyticsFunnelPanelClassName} aria-labelledby="engagement-funnel-heading">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="engagement-funnel-heading" className="text-lg font-semibold text-[var(--admin-on-surface)]">
          Engagement funnel
        </h2>
        <div className="flex items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-[var(--admin-primary)]" aria-hidden="true" />
            Converted
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-[var(--admin-border)]" aria-hidden="true" />
            Dropped
          </span>
        </div>
      </div>

      <ol className="space-y-6">
        {stages.map((stage, index) => (
          <li key={stage.stageKey} className="relative">
            {stage.dropPercent != null && index > 0 ? (
              <div className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-semibold text-[var(--admin-danger)]">
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                -{stage.dropPercent}% drop
              </div>
            ) : null}
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-[var(--admin-on-surface-variant)]">{stage.label}</span>
              <span className="font-mono text-[var(--admin-on-surface)]">{stage.count.toLocaleString()} events</span>
            </div>
            <div className="h-10 overflow-hidden rounded-sm bg-[var(--admin-border)]">
              <div
                className="h-full bg-[var(--admin-primary)] motion-safe:transition-[width]"
                style={{ width: `${stage.widthPercent}%` }}
                role="img"
                aria-label={`${stage.label} volume`}
              />
            </div>
          </li>
        ))}
      </ol>

      {insight ? (
        <div className={analyticsInsightBannerClassName}>
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            The largest drop-off occurs between{" "}
            <span className="font-semibold text-[var(--admin-on-surface)]">{insight.from}</span> and{" "}
            <span className="font-semibold text-[var(--admin-on-surface)]">{insight.to}</span>. Review content
            friction or prerequisites between these stages.
          </p>
        </div>
      ) : null}
    </section>
  );
}
