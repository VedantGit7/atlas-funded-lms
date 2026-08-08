"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  analyticsChartPanelClassName,
  analyticsEmptyStateClassName,
  ghostButtonClassName,
} from "../analytics-admin-shared";
import { getCompatibleVizTypes, resolveDefaultVizType } from "./compatibility";
import {
  AreaChartView,
  BarChartView,
  ComboChartView,
  FunnelChartView,
  HeatmapChartView,
  KpiView,
  LineChartView,
  PieChartView,
  PivotView,
  ProgressChartView,
  ScatterChartView,
  SparklineChartView,
  TableView,
} from "./charts";
import { getPreferredVizType, setPreferredVizType } from "./preference";
import { ALL_VIZ_TYPES, VIZ_TYPE_LABELS, type NormalizedResult, type VizType } from "./types";

type VisualizationPanelProps = {
  preferenceKey: string;
  data: NormalizedResult | null;
  defaultViz?: VizType | undefined;
  title?: string | undefined;
  filters?: ReactNode | undefined;
  loading?: boolean | undefined;
  emptyMessage?: string | undefined;
};

function renderViz(vizType: VizType, data: NormalizedResult) {
  switch (vizType) {
    case "kpi":
      return <KpiView data={data} />;
    case "table":
      return <TableView data={data} />;
    case "pivot":
      return <PivotView data={data} />;
    case "line":
      return <LineChartView data={data} />;
    case "area":
      return <AreaChartView data={data} />;
    case "bar":
      return <BarChartView data={data} />;
    case "combo":
      return <ComboChartView data={data} />;
    case "pie":
      return <PieChartView data={data} />;
    case "donut":
      return <PieChartView data={data} donut />;
    case "funnel":
      return <FunnelChartView data={data} />;
    case "progress":
      return <ProgressChartView data={data} />;
    case "scatter":
      return <ScatterChartView data={data} />;
    case "heatmap":
      return <HeatmapChartView data={data} />;
    case "sparkline":
      return <SparklineChartView data={data} />;
    default:
      return <TableView data={data} />;
  }
}

export function VisualizationPanel({
  preferenceKey,
  data,
  defaultViz = "table",
  title,
  filters,
  loading = false,
  emptyMessage = "No data to visualize.",
}: VisualizationPanelProps) {
  const compatible = useMemo(
    () => (data ? getCompatibleVizTypes(data) : (["table", "kpi"] as VizType[])),
    [data],
  );

  const [vizType, setVizType] = useState<VizType>(() => {
    const preferred = getPreferredVizType(preferenceKey);
    if (data) {
      return resolveDefaultVizType(data, preferred ?? defaultViz);
    }
    return preferred ?? defaultViz;
  });

  useEffect(() => {
    if (!data) return;
    const preferred = getPreferredVizType(preferenceKey);
    const next = resolveDefaultVizType(data, preferred ?? defaultViz);
    setVizType(next);
  }, [data, defaultViz, preferenceKey]);

  const onSelectViz = (next: VizType) => {
    if (!compatible.includes(next)) return;
    setVizType(next);
    setPreferredVizType(preferenceKey, next);
  };

  return (
    <section className={analyticsChartPanelClassName} aria-label={title ?? "Visualization"}>
      <div className="flex flex-col gap-3 border-b border-[var(--admin-outline-variant)] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title ? (
            <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
              {title}
            </h3>
          ) : null}
          {filters ? <div className="mt-2">{filters}</div> : null}
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Visualization type">
          {ALL_VIZ_TYPES.map((type) => {
            const enabled = compatible.includes(type);
            const selected = vizType === type;
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={!enabled}
                title={
                  enabled ? VIZ_TYPE_LABELS[type] : `${VIZ_TYPE_LABELS[type]} (not compatible)`
                }
                className={`${ghostButtonClassName} px-2.5 py-1 text-xs ${
                  selected ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]" : ""
                } ${!enabled ? "cursor-not-allowed opacity-40" : ""}`}
                onClick={() => {
                  onSelectViz(type);
                }}
              >
                {VIZ_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        {loading ? (
          <div className={analyticsEmptyStateClassName}>Loading visualization…</div>
        ) : !data || data.rows.length === 0 ? (
          <div className={analyticsEmptyStateClassName}>{emptyMessage}</div>
        ) : (
          renderViz(vizType, data)
        )}
      </div>
    </section>
  );
}

export function VisualizationPanelRetryButton({
  onClick,
  label = "Retry",
}: {
  onClick: () => void;
  label?: string | undefined;
}) {
  return (
    <button type="button" className={ghostButtonClassName} onClick={onClick}>
      {label}
    </button>
  );
}
