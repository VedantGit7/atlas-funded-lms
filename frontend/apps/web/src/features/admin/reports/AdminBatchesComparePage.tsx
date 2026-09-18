"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bookmark,
  Download,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchBatchesCompare,
  fetchBatchesRoster,
  type BatchCompareItem,
  type BatchCompareMetrics,
  type BatchesCompareNormalize,
  type BatchListItem,
} from "./admin-batches-roster-api";
import { csvEscape } from "@/lib/export/csv";

const MAX_SLOTS = 4;
const SAVE_KEY = "atlas.admin.batches.compare.saved";

const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const SWATCH_OPACITIES = [1, 0.7, 0.45, 0.28] as const;

type MetricKey = keyof BatchCompareMetrics;

type MetricDef = {
  key: MetricKey;
  label: string;
  format: "int" | "pct" | "minutes" | "days";
  higherIsBetter: boolean;
  section: "enrollment" | "performance" | "engagement";
};

const METRICS: MetricDef[] = [
  {
    key: "learners",
    label: "Learners",
    format: "int",
    higherIsBetter: true,
    section: "enrollment",
  },
  {
    key: "contentCompletionPct",
    label: "Content completion",
    format: "pct",
    higherIsBetter: true,
    section: "enrollment",
  },
  {
    key: "liveAttendancePct",
    label: "Live attendance",
    format: "pct",
    higherIsBetter: true,
    section: "enrollment",
  },
  {
    key: "testScorePct",
    label: "Test score",
    format: "pct",
    higherIsBetter: true,
    section: "performance",
  },
  {
    key: "passRatePct",
    label: "Pass rate",
    format: "pct",
    higherIsBetter: true,
    section: "performance",
  },
  {
    key: "activeLast14Days",
    label: "Active last 14 days",
    format: "int",
    higherIsBetter: true,
    section: "engagement",
  },
  {
    key: "atRiskLearners",
    label: "At-risk learners",
    format: "int",
    higherIsBetter: false,
    section: "engagement",
  },
  {
    key: "sessionsHeld",
    label: "Sessions held",
    format: "int",
    higherIsBetter: true,
    section: "engagement",
  },
  {
    key: "avgWatchMinutes",
    label: "Avg watch time",
    format: "minutes",
    higherIsBetter: true,
    section: "engagement",
  },
  {
    key: "medianDaysToFinish",
    label: "Median finish",
    format: "days",
    higherIsBetter: false,
    section: "engagement",
  },
];

const SPREAD_BANDS = [
  {
    key: "band0to25" as const,
    label: "0-25",
    tone: "bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
  },
  {
    key: "band26to50" as const,
    label: "26-50",
    tone: "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]",
  },
  {
    key: "band51to75" as const,
    label: "51-75",
    tone: "bg-[color-mix(in_srgb,var(--admin-primary)_60%,transparent)] text-[var(--admin-on-primary)]",
  },
  {
    key: "band76to100" as const,
    label: "76-100",
    tone: "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]",
  },
];

function parseIdsParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_SLOTS) break;
  }
  return ids;
}

function formatMetricValue(value: number | null | undefined, format: MetricDef["format"]): string {
  if (value == null || Number.isNaN(value)) return "-";
  if (format === "pct") return `${Math.round(value * 10) / 10}%`;
  if (format === "minutes") return `${Math.round(value)}m`;
  if (format === "days") return `${Math.round(value)}d`;
  return Math.round(value).toLocaleString();
}

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  if (startsAt && endsAt) return `${fmt(startsAt)} - ${fmt(endsAt)}`;
  if (startsAt) return `${fmt(startsAt)} - Active`;
  if (endsAt) return `Through ${fmt(endsAt)}`;
  return "Dates unset";
}

function bestIndexForMetric(items: BatchCompareItem[], metric: MetricDef): number | null {
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  items.forEach((item, index) => {
    const value = item.metrics[metric.key];
    if (value == null) return;
    if (bestVal == null) {
      bestVal = value;
      bestIdx = index;
      return;
    }
    if (metric.higherIsBetter ? value > bestVal : value < bestVal) {
      bestVal = value;
      bestIdx = index;
    }
  });
  return bestIdx;
}

function deltaVsBaseline(
  value: number | null,
  baseline: number | null,
  format: MetricDef["format"],
  higherIsBetter: boolean,
): { label: string; tone: "up" | "down" } | null {
  if (value == null || baseline == null) return null;
  const delta = value - baseline;
  if (Math.abs(delta) < 0.05) return null;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const abs = Math.abs(delta);
  let label: string;
  if (format === "pct") label = `${Math.round(abs * 10) / 10}%`;
  else if (format === "minutes") label = `${Math.round(abs)}m`;
  else if (format === "days") label = `${Math.round(abs)}d`;
  else label = `${Math.round(abs)}`;
  return { label, tone: improved ? "up" : "down" };
}

function downloadCsv(items: BatchCompareItem[]) {
  const headers = ["Metric", ...items.map((item) => item.name)];
  const lines = [headers.map(csvEscape).join(",")];
  for (const metric of METRICS) {
    const row = [
      metric.label,
      ...items.map((item) => formatMetricValue(item.metrics[metric.key], metric.format)),
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `batch-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded bg-[color-mix(in_srgb,var(--admin-surface-variant)_70%,var(--admin-surface))]",
        className,
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

function CompletionTrendChart({ items }: { items: BatchCompareItem[] }) {
  const width = 320;
  const height = 160;
  const pad = { top: 8, right: 8, bottom: 20, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxWeeks = Math.max(1, ...items.map((item) => item.trend.length));

  const paths = items.map((item, batchIndex) => {
    const points = item.trend
      .map((point, i) => {
        if (point.contentCompletionPct == null) return null;
        const x = pad.left + (maxWeeks <= 1 ? 0 : (i / (maxWeeks - 1)) * innerW);
        const y =
          pad.top +
          innerH -
          (Math.min(100, Math.max(0, point.contentCompletionPct)) / 100) * innerH;
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p != null);
    if (points.length === 0) return null;
    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    return { d, batchIndex, opacity: SWATCH_OPACITIES[batchIndex] ?? 0.4 };
  });

  const firstLabels = items[0]?.trend ?? [];
  const markers = [0.25, 0.5, 0.75]
    .map((ratio) => Math.round((maxWeeks - 1) * ratio))
    .filter((idx, i, arr) => idx > 0 && idx < maxWeeks - 1 && arr.indexOf(idx) === i);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label="Completion over time by batch"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = pad.top + innerH - (tick / 100) * innerH;
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="var(--admin-border)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--admin-on-surface-variant)]"
                style={{ fontSize: 9, fontFamily: "var(--font-mono, monospace)" }}
              >
                {tick}
              </text>
            </g>
          );
        })}
        {markers.map((idx) => {
          const x = pad.left + (maxWeeks <= 1 ? 0 : (idx / (maxWeeks - 1)) * innerW);
          const label = firstLabels[idx]?.weekLabel ?? `Wk ${idx + 1}`;
          return (
            <g key={idx}>
              <line
                x1={x}
                x2={x}
                y1={pad.top}
                y2={pad.top + innerH}
                stroke="var(--admin-outline)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={x + 4}
                y={pad.top + innerH - 4}
                className="fill-[var(--admin-outline)]"
                style={{ fontSize: 9, fontFamily: "var(--font-mono, monospace)" }}
              >
                {label}
              </text>
            </g>
          );
        })}
        {items.map((item, batchIndex) => {
          if (item.currentWeekIndex == null || !item.isRunning) return null;
          const idx = Math.min(item.currentWeekIndex, Math.max(0, maxWeeks - 1));
          const x = pad.left + (maxWeeks <= 1 ? 0 : (idx / (maxWeeks - 1)) * innerW);
          return (
            <line
              key={`now-${item.id}`}
              x1={x}
              x2={x}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--admin-primary)"
              strokeWidth={1.5}
              strokeOpacity={SWATCH_OPACITIES[batchIndex] ?? 0.5}
            />
          );
        })}
        {paths.map((path) =>
          path ? (
            <path
              key={path.batchIndex}
              d={path.d}
              fill="none"
              stroke="var(--admin-primary)"
              strokeOpacity={path.opacity}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
      </svg>
      <div className="flex justify-between px-1">
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {firstLabels[0]?.weekLabel ?? "Week 1"}
        </span>
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {firstLabels[firstLabels.length - 1]?.weekLabel ?? `Week ${maxWeeks}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full bg-[var(--admin-primary)]"
              style={{ opacity: SWATCH_OPACITIES[index] }}
            />
            <span className="text-[11px] text-[var(--admin-on-surface-variant)]">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpreadBars({ items }: { items: BatchCompareItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const spread = item.completionSpread;
        const total = spread.band0to25 + spread.band26to50 + spread.band51to75 + spread.band76to100;
        return (
          <div key={item.id}>
            <div className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">{item.name}</div>
            <div className="flex h-6 overflow-hidden rounded">
              {SPREAD_BANDS.map((band) => {
                const count = spread[band.key];
                const widthPct = total > 0 ? (count / total) * 100 : 0;
                if (widthPct <= 0) return null;
                return (
                  <div
                    key={band.key}
                    className={`flex items-center justify-center font-mono text-[11px] ${band.tone}`}
                    style={{ width: `${widthPct}%` }}
                    title={`${band.label}: ${count}`}
                  >
                    {count > 0 && widthPct >= 8 ? count : null}
                  </div>
                );
              })}
              {total === 0 ? (
                <div className="flex h-full w-full items-center justify-center bg-[var(--admin-surface-low)] font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  No data
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="flex justify-between border-t border-[var(--admin-border)] pt-2">
        {SPREAD_BANDS.map((band) => (
          <div key={band.key} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${band.tone.split(" ")[0] ?? ""}`} />
            <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {band.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCell({
  value,
  format,
  isBest,
  delta,
  showBar,
  barPct,
}: {
  value: number | null;
  format: MetricDef["format"];
  isBest: boolean;
  delta: { label: string; tone: "up" | "down" } | null;
  showBar: boolean;
  barPct: number;
}) {
  return (
    <div
      className={[
        "flex h-11 flex-col items-end justify-center gap-0.5 px-4 py-1",
        isBest
          ? "border-l-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_35%,transparent)] font-semibold text-[var(--admin-primary)]"
          : "text-[var(--admin-on-surface)]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm tabular-nums">{formatMetricValue(value, format)}</span>
        {delta ? (
          <span
            className={[
              "inline-flex items-center gap-0.5 rounded-sm border px-1 py-0.5 font-mono text-[11px]",
              delta.tone === "up"
                ? "border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
                : "border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
            ].join(" ")}
          >
            {delta.tone === "up" ? (
              <ArrowUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ArrowDown className="h-3 w-3" aria-hidden="true" />
            )}
            {delta.label}
          </span>
        ) : null}
      </div>
      {showBar && value != null ? (
        <div className="h-[3px] w-full max-w-[100px] overflow-hidden rounded-full bg-[var(--admin-border)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary)]"
            style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function FragmentSection({
  label,
  colSpan,
  children,
}: {
  label: string;
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_80%,transparent)]">
        <td
          colSpan={colSpan}
          className="px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface)]"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}

export function AdminBatchesComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickerId = useId();
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const idsFromUrl = useMemo(() => parseIdsParam(searchParams.get("ids")), [searchParams]);

  const [selectedIds, setSelectedIds] = useState<string[]>(idsFromUrl);
  const [normalize, setNormalize] = useState<BatchesCompareNormalize>("week_of_batch");
  const [items, setItems] = useState<BatchCompareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOptions, setPickerOptions] = useState<BatchListItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(idsFromUrl);
  }, [idsFromUrl]);

  const syncUrl = useCallback(
    (ids: string[]) => {
      const params = new URLSearchParams();
      if (ids.length > 0) params.set("ids", ids.join(","));
      const qs = params.toString();
      router.replace(
        qs ? `/admin/reports/batches/compare?${qs}` : "/admin/reports/batches/compare",
      );
    },
    [router],
  );

  const loadCompare = useCallback(async (ids: string[], mode: BatchesCompareNormalize) => {
    if (ids.length < 2) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBatchesCompare(ids, mode);
      setItems(response.data.items);
    } catch (err) {
      setItems([]);
      setError(err instanceof ClientApiError ? err.message : "Could not load batch comparison.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompare(selectedIds, normalize);
  }, [selectedIds, normalize, loadCompare]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
    };
  }, [pickerOpen]);

  const searchPicker = useCallback(async (q: string) => {
    setPickerLoading(true);
    try {
      const response = await fetchBatchesRoster({
        ...(q.trim() ? { q: q.trim() } : {}),
        page: 1,
        limit: 20,
        sortBy: "member_count",
        sortDir: "desc",
        window: "any",
        health: "any",
      });
      setPickerOptions(response.data.items);
    } catch {
      setPickerOptions([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = window.setTimeout(() => {
      void searchPicker(pickerQuery);
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, [pickerOpen, pickerQuery, searchPicker]);

  const addBatch = (id: string) => {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_SLOTS) return;
    const next = [...selectedIds, id];
    setSelectedIds(next);
    syncUrl(next);
    setPickerOpen(false);
    setPickerQuery("");
  };

  const removeBatch = (id: string) => {
    const next = selectedIds.filter((item) => item !== id);
    setSelectedIds(next);
    syncUrl(next);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          ids: selectedIds,
          normalize,
          savedAt: new Date().toISOString(),
        }),
      );
      setSaveMessage("Comparison saved on this device.");
      window.setTimeout(() => {
        setSaveMessage(null);
      }, 2500);
    } catch {
      setSaveMessage("Could not save comparison.");
    }
  };

  const handleRestoreSaved = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        setSaveMessage("No saved comparison found.");
        return;
      }
      const parsed = JSON.parse(raw) as {
        ids?: string[];
        normalize?: BatchesCompareNormalize;
      };
      const ids = Array.isArray(parsed.ids)
        ? parsed.ids.filter((id) => typeof id === "string").slice(0, MAX_SLOTS)
        : [];
      if (ids.length < 2) {
        setSaveMessage("Saved comparison needs at least two batches.");
        return;
      }
      if (parsed.normalize === "absolute_dates" || parsed.normalize === "week_of_batch") {
        setNormalize(parsed.normalize);
      }
      setSelectedIds(ids);
      syncUrl(ids);
      setSaveMessage("Restored saved comparison.");
    } catch {
      setSaveMessage("Could not restore comparison.");
    }
  };

  const emptySlots = Math.max(0, MAX_SLOTS - Math.max(selectedIds.length, items.length));
  const canCompare = selectedIds.length >= 2;
  const baseline = items[0] ?? null;
  const showTwoBatchDeltas = items.length >= 2;

  const sectionBlocks = useMemo(() => {
    const sections: Array<{
      key: string;
      label: string;
      metrics: MetricDef[];
    }> = [
      { key: "enrollment", label: "Enrollment & completion", metrics: [] },
      { key: "performance", label: "Assessment performance", metrics: [] },
      { key: "engagement", label: "Engagement", metrics: [] },
    ];
    for (const metric of METRICS) {
      const section = sections.find((s) => s.key === metric.section);
      section?.metrics.push(metric);
    }
    return sections.filter((s) => s.metrics.length > 0);
  }, []);

  let body: ReactNode;
  if (!canCompare) {
    body = (
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Comparison view
          </h2>
        </div>
        <div className="flex gap-3 overflow-x-auto border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          {Array.from({ length: MAX_SLOTS }).map((_, index) => (
            <div
              key={index}
              className={[
                "flex h-[72px] w-[140px] shrink-0 items-center justify-center rounded border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface)]",
                index >= 2 ? "opacity-50" : "",
              ].join(" ")}
            >
              <span className="text-xs text-[var(--admin-outline)]">Slot {index + 1}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center bg-[var(--admin-surface-low)] px-8 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <BarChart3
              className="h-8 w-8 text-[var(--admin-outline)]"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          </div>
          <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            Pick at least two batches to compare
          </h3>
          <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Select batches from the directory to populate the comparison matrix and identify
            performance trends.
          </p>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setPickerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Select batches
          </button>
        </div>
      </div>
    );
  } else if (loading && items.length === 0) {
    body = (
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-4">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-8 w-24" />
        </div>
        <div className="flex gap-3 overflow-hidden border-b border-[var(--admin-border)] bg-[var(--admin-bg)] p-4">
          <Shimmer className="h-[72px] w-[140px] shrink-0" />
          <Shimmer className="h-[72px] w-[140px] shrink-0" />
          <Shimmer className="h-[72px] w-[140px] shrink-0" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex gap-4">
              <Shimmer className="h-10 w-1/3" />
              <Shimmer className="h-10 w-1/3" />
              <Shimmer className="h-10 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  } else if (error) {
    body = (
      <div
        className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-6"
        role="alert"
      >
        <p className="text-sm font-medium text-[var(--admin-danger)]">
          Couldn&apos;t load comparison.
        </p>
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{error}</p>
        <button
          type="button"
          className={`${secondaryButtonClassName} mt-4`}
          onClick={() => void loadCompare(selectedIds, normalize)}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-[2] overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <th className="sticky left-0 z-10 w-1/4 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Metric
                  </th>
                  {items.map((item) => (
                    <th
                      key={item.id}
                      className="px-4 py-2 text-right text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                    >
                      {item.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectionBlocks.map((section) => (
                  <FragmentSection
                    key={section.key}
                    label={section.label}
                    colSpan={items.length + 1}
                  >
                    {section.metrics.map((metric) => {
                      const bestIdx = bestIndexForMetric(items, metric);
                      const values = items.map((item) => item.metrics[metric.key]);
                      const numeric = values.filter((v): v is number => v != null);
                      const maxAbs = numeric.length
                        ? Math.max(...numeric.map((v) => Math.abs(v)))
                        : 0;
                      const atRiskElevated =
                        metric.key === "atRiskLearners" &&
                        items.some(
                          (item) =>
                            item.metrics.learners > 0 &&
                            item.metrics.atRiskLearners / item.metrics.learners >= 0.15,
                        );

                      return (
                        <tr
                          key={metric.key}
                          className="group h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]"
                        >
                          <td className="sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-sm font-medium text-[var(--admin-on-surface)] group-hover:bg-[var(--admin-surface-high)]">
                            <div className="relative flex items-center gap-2 pl-2">
                              <span
                                className={[
                                  "absolute bottom-0 left-0 top-0 w-1 rounded-sm",
                                  atRiskElevated
                                    ? "bg-[var(--admin-danger)]"
                                    : "bg-[var(--admin-surface-variant)]",
                                ].join(" ")}
                                aria-hidden="true"
                              />
                              {metric.label}
                            </div>
                          </td>
                          {items.map((item, index) => {
                            const value = item.metrics[metric.key];
                            const delta =
                              showTwoBatchDeltas && index > 0 && baseline
                                ? deltaVsBaseline(
                                    value,
                                    baseline.metrics[metric.key],
                                    metric.format,
                                    metric.higherIsBetter,
                                  )
                                : null;
                            const barPct =
                              value != null && maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0;
                            return (
                              <td key={item.id} className="p-0 align-middle">
                                <MetricCell
                                  value={value}
                                  format={metric.format}
                                  isBest={bestIdx === index}
                                  delta={delta}
                                  showBar={metric.format === "pct"}
                                  barPct={barPct}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </FragmentSection>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 p-4 md:hidden">
            {METRICS.map((metric) => {
              const bestIdx = bestIndexForMetric(items, metric);
              return (
                <div
                  key={metric.key}
                  className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    {metric.label}
                  </p>
                  <ul className="space-y-2">
                    {items.map((item, index) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-[var(--admin-on-surface-variant)]">
                          {item.name}
                        </span>
                        <span
                          className={[
                            "font-mono tabular-nums",
                            bestIdx === index
                              ? "font-semibold text-[var(--admin-primary)]"
                              : "text-[var(--admin-on-surface)]",
                          ].join(" ")}
                        >
                          {formatMetricValue(item.metrics[metric.key], metric.format)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-[280px] flex-1 flex-col gap-6">
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Completion over time
            </h3>
            <CompletionTrendChart items={items} />
          </div>
          <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Completion spread
            </h3>
            <SpreadBars items={items} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
            <Link
              href="/admin/reports/batches"
              className="inline-flex items-center gap-1 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Batches
            </Link>
            <span className="text-[var(--admin-outline)]">/</span>
            <span className="text-[var(--admin-on-surface)]">Compare</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Compare batches
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Put two to four cohorts side by side on the same metrics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={!canCompare || items.length === 0}
            onClick={() => {
              downloadCsv(items);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export comparison
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={handleRestoreSaved}>
            Restore saved
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={selectedIds.length < 2}
            onClick={handleSave}
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            Save comparison
          </button>
        </div>
      </div>

      {saveMessage ? (
        <p className="text-xs text-[var(--admin-success)]" role="status">
          {saveMessage}
        </p>
      ) : null}

      <div className="relative flex flex-wrap items-end gap-3 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <div className="flex min-w-0 flex-1 flex-wrap gap-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex min-w-[180px] flex-1 flex-col justify-between rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full bg-[var(--admin-primary)]"
                    style={{ opacity: SWATCH_OPACITIES[index] }}
                  />
                  <span className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                    {item.name}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-[var(--admin-outline)] transition-colors hover:text-[var(--admin-danger)]"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => {
                    removeBatch(item.id);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {item.key}
                </span>
                <span className="font-mono text-sm text-[var(--admin-on-surface)]">
                  {item.metrics.learners.toLocaleString()} learners
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatDateRange(item.startsAt, item.endsAt)}
                {index === 0 && items.length >= 2 ? " · Baseline" : null}
              </p>
            </div>
          ))}

          {selectedIds.length > 0 && items.length === 0 && !loading
            ? selectedIds.map((id) => (
                <div
                  key={id}
                  className="flex min-w-[180px] flex-1 items-center justify-between rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"
                >
                  <span className="truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    {id.slice(0, 8)}…
                  </span>
                  <button
                    type="button"
                    className="text-[var(--admin-outline)] hover:text-[var(--admin-danger)]"
                    onClick={() => {
                      removeBatch(id);
                    }}
                    aria-label="Remove batch"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            : null}

          {Array.from({ length: emptySlots }).map((_, index) => (
            <button
              key={`empty-${index}`}
              type="button"
              className="flex min-w-[180px] flex-1 items-center justify-center gap-2 rounded border-2 border-dashed border-[var(--admin-outline)] p-3 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] hover:text-[var(--admin-primary)]"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add batch
            </button>
          ))}
        </div>

        <div className="w-full max-w-[220px]">
          <label
            htmlFor={`${pickerId}-normalize`}
            className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
          >
            Normalise by
          </label>
          <Select
            id={`${pickerId}-normalize`}
            value={normalize}
            onValueChange={(value) => {
              setNormalize(value as BatchesCompareNormalize);
            }}
            options={[
              { value: "week_of_batch", label: "Week of batch" },
              { value: "absolute_dates", label: "Absolute dates" },
            ]}
          />
        </div>

        <div ref={pickerRef}>
          {pickerOpen ? (
            <div className="absolute left-4 top-full z-30 mt-2 w-[min(100%-2rem,28rem)] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg">
              <div className="relative mb-2">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
                  aria-hidden="true"
                />
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(event) => {
                    setPickerQuery(event.target.value);
                  }}
                  placeholder="Search batches…"
                  className="h-9 w-full rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {pickerLoading ? (
                  <li className="px-2 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                    Searching…
                  </li>
                ) : null}
                {!pickerLoading && pickerOptions.length === 0 ? (
                  <li className="px-2 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                    No batches found.
                  </li>
                ) : null}
                {pickerOptions.map((batch) => {
                  const disabled =
                    selectedIds.includes(batch.id) || selectedIds.length >= MAX_SLOTS;
                  return (
                    <li key={batch.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          addBatch(batch.id);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[var(--admin-on-surface)]">
                            {batch.name}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {batch.key} · {batch.memberCount} learners
                          </span>
                        </span>
                        {selectedIds.includes(batch.id) ? (
                          <span className="text-[11px] text-[var(--admin-primary)]">Added</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className={`${ghostButtonClassName} mt-2 w-full`}
                onClick={() => {
                  setPickerOpen(false);
                }}
              >
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {body}
    </div>
  );
}
