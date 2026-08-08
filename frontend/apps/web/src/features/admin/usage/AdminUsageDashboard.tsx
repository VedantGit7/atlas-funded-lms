"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { billingBackLinkClassName } from "../billing/billing-admin-shared";
import {
  buildBuckets,
  buildMonthColumns,
  formatGb,
  formatGrowthLabel,
  formatHours,
  formatLongDate,
  formatShortDate,
  usagePercent,
  type Granularity,
  type UsageSummary,
} from "./usage-dashboard-utils";

type AdminUsageDashboardProps = {
  summary: UsageSummary;
};

const CHART_GRID = "var(--admin-border)";
const CHART_LINE = "var(--admin-primary)";
const CHART_FILL = "color-mix(in srgb, var(--admin-primary) 10%, transparent)";

const panelClassName =
  "rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm sm:p-6";

const GRANULARITY_OPTIONS = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
];

export function AdminUsageDashboard({ summary }: AdminUsageDashboardProps) {
  const now = useMemo(() => new Date(), []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <Link href="/admin/billing" prefetch={false} className={billingBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Usage Insights
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Monitor your active learners, storage &amp; bandwidth. Plan active from{" "}
          <span className="font-semibold text-[var(--admin-on-surface)]">
            {formatLongDate(summary.planStartedAt)}
          </span>
          , next billing date is{" "}
          <span className="font-semibold text-[var(--admin-on-surface)]">
            {formatLongDate(summary.nextBillingAt)}
          </span>
          .
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          label="Average MAU"
          value={String(summary.currentMau)}
          hint
          used={summary.currentMau}
          limit={summary.limits.mau}
          format={(n) => n.toLocaleString()}
        />
        <KpiTile label="Total Learners" value={String(summary.totalLearners)} />
        <KpiTile
          label="Total Video Hours"
          value={formatHours(summary.totalVideoHours)}
          hint
          used={summary.totalVideoHours}
          limit={summary.limits.videoHours}
          format={formatHours}
        />
        <KpiTile
          label="Total Storage Used"
          value={formatGb(summary.totalStorageGb)}
          used={summary.totalStorageGb}
          limit={summary.limits.storageGb}
          format={formatGb}
        />
        <KpiTile label="Subscribed Plan" value={summary.planName ?? "—"} emphasise />
      </section>

      <p className="flex items-center gap-1.5 text-sm text-[var(--admin-on-surface-variant)]">
        <Info className="h-4 w-4" aria-hidden="true" />
        The data presented is from {formatShortDate(summary.planStartedAt)}
      </p>

      <StorageAlert summary={summary} />

      <MauChartPanel summary={summary} now={now} />

      <ComparisonTiles comparison={summary.mau.comparison} />

      <CumulativeUsagesTable summary={summary} now={now} />

      <ContentStorageChart summary={summary} now={now} />

      <StorageBreakdownTable summary={summary} now={now} />
    </div>
  );
}

function limitBarColor(percent: number): string {
  if (percent >= 90) return "var(--admin-danger)";
  if (percent >= 75) return "var(--admin-warning)";
  return "var(--admin-primary)";
}

function KpiTile({
  label,
  value,
  hint = false,
  emphasise = false,
  used,
  limit,
  format,
}: {
  label: string;
  value: string;
  hint?: boolean;
  emphasise?: boolean;
  used?: number;
  limit?: number | null;
  format?: (value: number) => string;
}) {
  const percent = used != null ? usagePercent(used, limit ?? null) : null;
  const showBar = used != null && limit != null && limit > 0 && format != null;
  const showUnlimited = used != null && limit === null;

  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3.5 shadow-sm">
      <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
        {label}
        {hint ? <Info className="h-3 w-3 opacity-70" aria-hidden="true" /> : null}
      </p>
      <p
        className={`mt-1.5 truncate font-bold text-[var(--admin-on-surface)] ${emphasise ? "text-lg" : "text-2xl"}`}
      >
        {value}
      </p>
      {showBar && percent != null ? (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full rounded-full motion-safe:transition-all"
              style={{ width: `${String(percent)}%`, backgroundColor: limitBarColor(percent) }}
            />
          </div>
          <p className="text-[10px] text-[var(--admin-on-surface-variant)]">
            {format(used)} / {format(limit)} · {String(percent)}%
          </p>
        </div>
      ) : showUnlimited ? (
        <p className="mt-2 text-[10px] font-medium text-[var(--admin-on-surface-variant)]">
          Unlimited
        </p>
      ) : null}
    </div>
  );
}

function StorageAlert({ summary }: { summary: UsageSummary }) {
  const percent = usagePercent(summary.totalStorageGb, summary.limits.storageGb);
  if (percent == null || percent < 80) {
    return null;
  }
  const over = percent >= 100;
  const heading = over ? "Storage limit reached" : "Optimize Storage Usage";
  const body = over
    ? `You have used ${String(percent)}% of your storage. Remove dormant content or upgrade your plan.`
    : "You're close to your storage limit. Remove dormant content to free up space.";

  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--admin-danger)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-5 py-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">{heading}</span>
        <span className="block text-sm text-[var(--admin-on-surface-variant)]">{body}</span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
    </button>
  );
}

function MauChartPanel({ summary, now }: { summary: UsageSummary; now: Date }) {
  const [granularity, setGranularity] = useState<Granularity>("months");
  const buckets = useMemo(() => buildBuckets(granularity, now), [granularity, now]);
  const values = useMemo(() => {
    const series = granularity === "days" ? summary.mau.daily : summary.mau.monthly;
    const byPeriod = new Map(series.map((point) => [point.period, point.value]));
    return buckets.map((bucket) => byPeriod.get(bucket.period) ?? 0);
  }, [buckets, granularity, summary.mau]);
  const currentMonth = `${now.toLocaleString("en", { month: "short" })} ${String(now.getFullYear())}`;

  return (
    <section className={panelClassName} aria-labelledby="mau-heading">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 id="mau-heading" className="text-base font-bold text-[var(--admin-on-surface)]">
          Monthly Active Users
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={granularity}
            onValueChange={(value) => {
              setGranularity(value as Granularity);
            }}
            options={GRANULARITY_OPTIONS}
            ariaLabel="Chart granularity"
            className="w-28 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
          />
          <button
            type="button"
            onClick={() => {
              setGranularity("months");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--admin-on-surface)]">
        <span className="text-xl font-bold">{summary.mau.comparison.current}</span>{" "}
        <span className="text-[var(--admin-on-surface-variant)]">(For {currentMonth})</span>
      </p>

      <LineChart
        labels={buckets.map((bucket) => bucket.label)}
        values={values}
        yLabel="Number Of Users"
        xLabel="Timeline"
        valueSuffix=" users"
      />
    </section>
  );
}

function ComparisonTiles({ comparison }: { comparison: UsageSummary["mau"]["comparison"] }) {
  const fmt = (value: number | null) => (value == null ? "–" : String(value));
  const current = comparison.current;
  const tiles = [
    { label: "Current", value: String(current) },
    { label: "1 months ago", value: fmt(comparison.m1) },
    { label: "3 months ago", value: fmt(comparison.m3) },
    { label: "6 months ago", value: fmt(comparison.m6) },
    { label: "9 months ago", value: fmt(comparison.m9) },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 text-center shadow-sm"
          >
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--admin-on-surface)]">{tile.value}</p>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-sm text-[var(--admin-on-surface-variant)]">
        <TrendingUp className="h-4 w-4" aria-hidden="true" />
        Your MAU has grown{" "}
        <span className="font-semibold text-[var(--admin-success)]">{formatGrowthLabel(current)}</span>{" "}
        over the last 9 months. Growth compares each period to your current balance.
      </p>
    </div>
  );
}

const CUMULATIVE_ROW_LABELS = [
  "Bandwidth",
  "Test Submits",
  "DRM Tokens",
  "Message Sends",
  "Email Validations",
  "Total Learners",
  "Content Storage",
];

function CumulativeUsagesTable({ summary, now }: { summary: UsageSummary; now: Date }) {
  const columns = useMemo(() => buildMonthColumns(now, 9), [now]);
  const historyByPeriod = useMemo(
    () => new Map(summary.history.map((entry) => [entry.period, entry])),
    [summary.history],
  );

  // Current column uses live values; earlier months use gauge snapshots where
  // present (Tier A) and an em dash otherwise. Tier-B metrics (bandwidth, DRM,
  // messaging) are only known for the current period until metered.
  function cell(rowLabel: string, period: string, isCurrent: boolean): string {
    const c = summary.current;
    const hist = historyByPeriod.get(period);
    switch (rowLabel) {
      case "Bandwidth":
        return isCurrent ? formatGb(c.bandwidthGb) : "–";
      case "Test Submits":
        return isCurrent ? String(c.testSubmits) : hist ? String(hist.testSubmits) : "–";
      case "DRM Tokens":
        return isCurrent ? String(c.drmTokens) : "–";
      case "Message Sends":
        return isCurrent ? String(c.messageSends) : hist ? String(hist.messageSends) : "–";
      case "Email Validations":
        return isCurrent ? String(c.emailValidations) : hist ? String(hist.emailValidations) : "–";
      case "Total Learners":
        return isCurrent ? String(c.totalLearners) : hist ? String(hist.totalLearners) : "–";
      case "Content Storage":
        return isCurrent ? formatGb(c.contentStorageGb) : hist ? formatGb(hist.storageGb) : "–";
      default:
        return "–";
    }
  }

  return (
    <UsageTable
      title="Cumulative Usages"
      description="Running totals across recent months."
      firstColHeader="Cumulative Usages"
      columns={columns}
      rows={CUMULATIVE_ROW_LABELS.map((label) => ({
        label,
        cells: columns.map((column) => cell(label, column.period, column.current)),
      }))}
    />
  );
}

function StorageBreakdownTable({ summary, now }: { summary: UsageSummary; now: Date }) {
  const columns = useMemo(() => buildMonthColumns(now, 8), [now]);
  const historyByPeriod = useMemo(
    () => new Map(summary.history.map((entry) => [entry.period, entry])),
    [summary.history],
  );

  function cell(rowLabel: string, period: string, isCurrent: boolean): string {
    const c = summary.current;
    const hist = historyByPeriod.get(period);
    switch (rowLabel) {
      case "Products":
        return isCurrent ? String(c.products) : hist ? String(hist.products) : "–";
      case "Video Transcoding":
        return isCurrent ? formatHours(c.videoTranscodingHours) : "–";
      case "Questions":
        return isCurrent ? String(c.questions) : hist ? String(hist.questions) : "–";
      default:
        return "–";
    }
  }

  return (
    <UsageTable
      title="Storage Breakdown Metrics"
      description="Breakdown of content occupying your storage."
      firstColHeader="Storage Breakdown Metrics"
      columns={columns}
      rows={["Products", "Video Transcoding", "Questions"].map((label) => ({
        label,
        cells: columns.map((column) => cell(label, column.period, column.current)),
      }))}
    />
  );
}

function UsageTable({
  title,
  description,
  firstColHeader,
  columns,
  rows,
}: {
  title: string;
  description: string;
  firstColHeader: string;
  columns: Array<{ key: string; label: string; current: boolean }>;
  rows: Array<{ label: string; cells: string[] }>;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-[var(--admin-on-surface)]">{title}</h2>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">{description}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)]">
              <th className="sticky left-0 z-10 whitespace-nowrap bg-[var(--admin-surface)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                {firstColHeader}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold text-[var(--admin-on-surface-variant)] ${column.current ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-[var(--admin-border)] last:border-b-0">
                <th className="sticky left-0 z-10 whitespace-nowrap bg-[var(--admin-surface)] px-4 py-3 text-left font-semibold text-[var(--admin-on-surface)]">
                  {row.label}
                </th>
                {row.cells.map((cell, index) => {
                  const column = columns[index];
                  return (
                    <td
                      key={column?.key ?? index}
                      className={`whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)] ${column?.current ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]" : ""}`}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ContentStorageChart({ summary, now }: { summary: UsageSummary; now: Date }) {
  const buckets = useMemo(() => buildBuckets("months", now), [now]);

  return (
    <section className={panelClassName} aria-labelledby="content-storage-heading">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="content-storage-heading" className="text-base font-bold text-[var(--admin-on-surface)]">
            Content Storage
          </h2>
          <p className="mt-1 text-sm">
            <span className="text-lg font-bold text-[var(--admin-on-surface)]">
              {formatHours(summary.current.videoTranscodingHours)}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
        >
          Top Products by Video Transcoding Hours
        </button>
      </div>

      <LineChart
        labels={buckets.map((bucket) => bucket.label)}
        values={buckets.map(() => 0)}
        yLabel="No Of Hours"
        xLabel="Timeline"
        valueSuffix=" hrs"
        showMarkersOnZero
      />

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--admin-primary)]" aria-hidden="true" />
        Video Transcoding Hours
      </div>
    </section>
  );
}

function LineChart({
  labels,
  values,
  yLabel,
  xLabel,
  valueSuffix,
  showMarkersOnZero = false,
}: {
  labels: string[];
  values: number[];
  yLabel: string;
  xLabel: string;
  valueSuffix: string;
  showMarkersOnZero?: boolean;
}) {
  const width = 820;
  const height = 260;
  const padX = 44;
  const padY = 24;
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...values, 1);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = values.map((value, index) => ({
    x: padX + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW),
    y: padY + innerH - (value / max) * innerH,
    value,
    label: labels[index] ?? "",
  }));

  const linePath = coords
    .map((point, index) => {
      const prev = coords[index - 1];
      if (index === 0 || !prev) return `M ${String(point.x)} ${String(point.y)}`;
      const cx = (prev.x + point.x) / 2;
      return `C ${String(cx)} ${String(prev.y)}, ${String(cx)} ${String(point.y)}, ${String(point.x)} ${String(point.y)}`;
    })
    .join(" ");
  const firstPoint = coords[0];
  const lastPoint = coords[coords.length - 1];
  const areaPath =
    firstPoint && lastPoint
      ? `${linePath} L ${String(lastPoint.x)} ${String(height - padY)} L ${String(firstPoint.x)} ${String(height - padY)} Z`
      : "";

  const labelStep = Math.max(1, Math.ceil(labels.length / 8));
  const hoverPoint = hover != null ? coords[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${String(width)} ${String(height + 22)}`}
        className="h-64 w-full overflow-visible"
        role="img"
        aria-label={`${yLabel} over ${xLabel.toLowerCase()}`}
        onMouseLeave={() => {
          setHover(null);
        }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const svgX = ((event.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let best = Infinity;
          coords.forEach((point, index) => {
            const distance = Math.abs(point.x - svgX);
            if (distance < best) {
              best = distance;
              nearest = index;
            }
          });
          setHover(nearest);
        }}
      >
        <text
          x={10}
          y={padY + innerH / 2}
          fill="var(--admin-on-surface-variant)"
          fontSize={10}
          textAnchor="middle"
          transform={`rotate(-90 12 ${String(padY + innerH / 2)})`}
        >
          {yLabel}
        </text>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padY + innerH * ratio;
          return (
            <line
              key={ratio}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke={CHART_GRID}
              strokeDasharray={ratio === 1 ? undefined : "4"}
            />
          );
        })}

        {areaPath ? <path d={areaPath} fill={CHART_FILL} /> : null}
        {linePath ? (
          <path d={linePath} fill="none" stroke={CHART_LINE} strokeWidth={2} strokeLinecap="round" />
        ) : null}

        {coords.map((point, index) =>
          point.value > 0 || showMarkersOnZero ? (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={point.value > 0 ? 4 : 3}
              fill="var(--admin-surface)"
              stroke={CHART_LINE}
              strokeWidth={2}
            />
          ) : null,
        )}

        {hoverPoint ? (
          <>
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={padY}
              y2={height - padY}
              stroke={CHART_LINE}
              strokeOpacity={0.4}
            />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r={5} fill={CHART_LINE} />
          </>
        ) : null}

        {coords.map((point, index) =>
          index % labelStep === 0 || index === coords.length - 1 ? (
            <text
              key={`label-${String(index)}`}
              x={point.x}
              y={height - padY + 16}
              textAnchor="middle"
              fill="var(--admin-on-surface-variant)"
              fontSize={10}
            >
              {point.label}
            </text>
          ) : null,
        )}

        <text
          x={width / 2}
          y={height + 14}
          textAnchor="middle"
          fill="var(--admin-on-surface-variant)"
          fontSize={10}
          fontWeight={600}
        >
          {xLabel}
        </text>
      </svg>

      {hoverPoint ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${String((hoverPoint.x / width) * 100)}%`,
            top: `${String((hoverPoint.y / (height + 22)) * 100)}%`,
          }}
        >
          <p className="font-semibold text-[var(--admin-on-surface)]">
            {String(hoverPoint.value)}
            {valueSuffix}
          </p>
          <p className="text-[var(--admin-on-surface-variant)]">{hoverPoint.label}</p>
        </div>
      ) : null}
    </div>
  );
}
