"use client";



import { CheckCircle2, Info, TrendingDown, TrendingUp } from "lucide-react";

import { Skeleton } from "@atlas/design-system";

import type { HeroMetric } from "../analytics-admin-utils";

import { getMetricDescription } from "../metric-glossary";

import {

  analyticsMetricCardClassName,

  analyticsMetricLabelClassName,

  analyticsMetricValueClassName,

} from "../analytics-admin-shared";



function SparkBars({ values }: { values: number[] }) {

  if (values.length === 0) {

    return (

      <div className="flex h-10 w-24 items-end gap-1 opacity-40" aria-hidden="true">

        {[40, 60, 50, 80, 100].map((height, index) => (

          <div

            key={index}

            className="w-2 rounded-t-sm bg-[var(--admin-primary)]"

            style={{ height: `${height / 10}%` }}

          />

        ))}

      </div>

    );

  }



  const max = Math.max(...values, 1);

  return (

    <div className="flex h-10 w-24 items-end gap-1" aria-hidden="true">

      {values.map((value, index) => (

        <div

          key={index}

          className="w-2 rounded-t-sm bg-[var(--admin-primary)]"

          style={{

            height: `${Math.max(12, Math.round((value / max) * 100))}%`,

            opacity: 0.35 + (index / values.length) * 0.65,

          }}

        />

      ))}

    </div>

  );

}



function CompletionBar({ percent }: { percent: number }) {

  return (

    <div className="flex w-24 flex-col justify-end gap-1" aria-hidden="true">

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-border)]">

        <div

          className="h-full rounded-full bg-[var(--admin-success)]"

          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}

        />

      </div>

      <span className="text-right font-mono text-[10px] text-[var(--admin-on-surface-variant)]">

        {percent > 0 ? `${percent}%` : "—"}

      </span>

    </div>

  );

}



type AnalyticsAdminMetricCardsProps = {

  metrics: HeroMetric[];

  loading?: boolean;

  onMetricClick?: (metric: HeroMetric) => void;

};



export function AnalyticsAdminMetricCards({

  metrics,

  loading = false,

  onMetricClick,

}: AnalyticsAdminMetricCardsProps) {

  if (loading) {

    return (

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-hidden="true">

        {[0, 1, 2].map((index) => (

          <Skeleton key={index} className="h-32 rounded-xl bg-[var(--admin-surface-high)]" />

        ))}

      </div>

    );

  }



  if (metrics.length === 0) return null;



  return (

    <section aria-label="Summary metrics" className="grid grid-cols-1 gap-4 md:grid-cols-3">

      {metrics.map((metric) => {

        const clickable = Boolean(onMetricClick);

        return (

          <article

            key={metric.key}

            className={`${analyticsMetricCardClassName}${clickable ? " cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-[var(--admin-primary)]" : ""}`}

          >

            {clickable ? (

              <button

                type="button"

                className="block w-full text-left"

                aria-label={`View members for ${metric.label}`}

                onClick={() => {

                  onMetricClick?.(metric);

                }}

              >

                <MetricCardBody metric={metric} />

              </button>

            ) : (

              <MetricCardBody metric={metric} />

            )}

          </article>

        );

      })}

    </section>

  );

}



function MetricCardBody({ metric }: { metric: HeroMetric }) {

  return (

    <>

      <div className="mb-3 flex items-start justify-between gap-3">

        <span className={`${analyticsMetricLabelClassName} inline-flex items-center gap-1`}>

          {metric.label}

          <span

            className="inline-flex text-[var(--admin-on-surface-variant)]"

            title={getMetricDescription(metric.key, metric.label)}

            aria-label={getMetricDescription(metric.key, metric.label)}

          >

            <Info className="h-3.5 w-3.5" aria-hidden="true" />

          </span>

        </span>

        {metric.key === "completion_rate" || metric.key === "pass_rate" ? (

          <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-1.5 py-0.5 text-[11px] font-bold text-[var(--admin-success)]">

            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />

            {metric.tone === "up" ? "Healthy" : "Review"}

          </span>

        ) : metric.deltaPercent != null ? (

          <span

            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${

              metric.tone === "up"

                ? "bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]"

                : "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]"

            }`}

          >

            {metric.tone === "up" ? (

              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />

            ) : (

              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />

            )}

            {metric.deltaPercent > 0 ? "+" : ""}

            {metric.deltaPercent}%

          </span>

        ) : null}

      </div>

      <div className="flex items-end justify-between gap-3">

        <p className={analyticsMetricValueClassName} aria-label={`${metric.label} value`}>

          {metric.displayValue}

        </p>

        {metric.key === "completion_rate" || metric.key === "pass_rate" ? (

          <CompletionBar percent={metric.value} />

        ) : (

          <SparkBars values={metric.sparkline} />

        )}

      </div>

    </>

  );

}

