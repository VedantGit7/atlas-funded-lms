"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import type {
  InsightSalesAttributionBoard,
  InsightSalesAttributionComposition,
  InsightSalesAttributionSource,
} from "./admin-insights-api";
import {
  csvEscape,
  formatInsightMoney,
  formatInsightMoneyWithCode,
  formatInsightNumber,
} from "./admin-insights-format";
import {
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

type SalesInsightAttributionViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightSalesAttributionBoard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

type SortKey = "source" | "events" | "revenue" | "share" | "rate";

const PAGE_SIZE = 8;
const NAMED_FILLS = [
  "var(--admin-primary)",
  "color-mix(in srgb, var(--admin-primary) 72%, var(--admin-surface-high))",
  "color-mix(in srgb, var(--admin-primary) 48%, var(--admin-surface-high))",
  "color-mix(in srgb, var(--admin-primary) 28%, var(--admin-surface-high))",
] as const;

function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function compositionFill(segment: InsightSalesAttributionComposition, index: number): string {
  if (segment.kind === "unattributed") return "var(--admin-warning)";
  if (segment.kind === "other") {
    return "color-mix(in srgb, var(--admin-on-surface-variant) 55%, var(--admin-surface))";
  }
  return NAMED_FILLS[index] ?? "var(--admin-primary)";
}

function sourceFill(
  source: InsightSalesAttributionSource,
  board: InsightSalesAttributionBoard,
): string {
  const namedIndex = board.composition.findIndex((segment) => segment.id === source.id);
  if (namedIndex >= 0) return NAMED_FILLS[namedIndex] ?? "var(--admin-primary)";
  return "color-mix(in srgb, var(--admin-on-surface-variant) 55%, var(--admin-surface))";
}

function attributionCsv(board: InsightSalesAttributionBoard): string {
  const lines = [
    ["Source", "Events", "Attributed revenue", "Share of attributed", "Revenue per event"]
      .map(csvEscape)
      .join(","),
  ];
  for (const row of board.sources) {
    lines.push(
      [
        row.label,
        row.events,
        row.revenueMajor.toFixed(2),
        row.revenueSharePct == null ? "-" : `${row.revenueSharePct}%`,
        row.revenuePerEvent == null ? "-" : row.revenuePerEvent.toFixed(2),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  if (board.unattributedRevenue > 0) {
    const share =
      board.totalRevenue > 0
        ? `${Math.round((board.unattributedRevenue / board.totalRevenue) * 1000) / 10}% of total`
        : "-";
    lines.push(
      ["unattributed", "-", board.unattributedRevenue.toFixed(2), share, "-"]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function Shimmer({ className, widthPct }: { className: string; widthPct?: number | undefined }) {
  return (
    <div
      className={`${insightShimmerClassName} ${className}`}
      style={widthPct != null ? { width: `${String(widthPct)}%` } : undefined}
    />
  );
}

function AttributionSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading attribution">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
        <Shimmer className="h-5 w-5 rounded-full" />
        <Shimmer className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 5 }, (_, index) => (
          <section
            key={index}
            className={`rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 ${index === 0 ? "xl:col-span-2" : ""}`}
          >
            <Shimmer className="mb-4 h-3 w-28" />
            <Shimmer className="mb-4 h-8 w-36" />
            <Shimmer className="h-3 w-24" />
          </section>
        ))}
      </div>
      <section className={`${insightPanelClassName} p-6`}>
        <div className="mb-4 flex justify-between">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-4 w-28" />
        </div>
        <div className="flex h-8 overflow-hidden rounded-md">
          <Shimmer className="h-full rounded-none" widthPct={40} />
          <Shimmer className="h-full rounded-none opacity-80" widthPct={25} />
          <Shimmer className="h-full rounded-none opacity-60" widthPct={20} />
          <Shimmer className="h-full rounded-none opacity-40" widthPct={15} />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className={`${insightPanelClassName} hidden h-[400px] p-6 lg:col-span-7 lg:flex`}>
          <Shimmer className="mb-6 h-5 w-48" />
          <div className="relative flex-1">
            <Shimmer className="absolute h-4 w-4 rounded-full" />
            <Shimmer className="absolute left-[30%] top-[40%] h-5 w-5 rounded-full" />
            <Shimmer className="absolute left-[70%] top-[20%] h-3 w-3 rounded-full" />
          </div>
        </section>
        <section className={`${insightPanelClassName} h-[400px] p-6 lg:col-span-5`}>
          <Shimmer className="mb-6 h-5 w-40" />
          <div className="space-y-4">
            {[80, 65, 50, 40, 28].map((width) => (
              <div key={width} className="space-y-2">
                <div className="flex justify-between">
                  <Shimmer className="h-3 w-32" />
                  <Shimmer className="h-3 w-16" />
                </div>
                <Shimmer className="h-[3px]" widthPct={width} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className={insightPanelClassName}>
        <div className="flex h-11 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="h-8 w-48" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="ml-auto h-4 w-16" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </section>
    </div>
  );
}

function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]">
        <AlertCircle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--admin-danger)]">
          Unable to load attribution
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">{message}</p>
        <button
          type="button"
          className={`${insightGhostButtonClassName} mt-4 border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] text-[var(--admin-danger)]`}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry connection
        </button>
      </div>
    </div>
  );
}

function ShareBar({ pct, fill }: { pct: number | null; fill?: string | undefined }) {
  const width = pct == null ? 0 : Math.min(Math.max(pct, 0), 100);
  return (
    <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
      <div
        className="h-full rounded-full bg-[var(--admin-primary)]"
        style={{ width: `${String(width)}%`, ...(fill ? { backgroundColor: fill } : {}) }}
      />
    </div>
  );
}

function PatternPill({ pattern }: { pattern: InsightSalesAttributionSource["pattern"] }) {
  if (!pattern) return null;
  const highValue = pattern === "low-volume high-value";
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-data text-[11px] font-medium leading-none ${
        highValue
          ? "border border-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]"
          : "border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
      }`}
    >
      {pattern}
    </span>
  );
}

function ScatterPlot({
  board,
  activeId,
  onSelect,
}: {
  board: InsightSalesAttributionBoard;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const maxEvents = Math.max(board.maxEvents, 1);
  const maxRevenue = Math.max(board.maxRevenue, 1);
  const rate = board.revenuePerEvent;
  const xOf = (events: number) => (events / maxEvents) * 100;
  const yOf = (revenue: number) => 100 - (revenue / maxRevenue) * 100;

  let lineX2 = 100;
  let lineY2 = 0;
  if (rate != null && rate > 0) {
    const expectedAtMax = maxEvents * rate;
    if (expectedAtMax <= maxRevenue) {
      lineX2 = 100;
      lineY2 = yOf(expectedAtMax);
    } else {
      lineX2 = xOf(maxRevenue / rate);
      lineY2 = 0;
    }
  }

  const hover = board.sources.find((row) => row.id === hoverId) ?? null;

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[12px] text-[var(--admin-on-surface-variant)]">
        Attributed revenue
      </div>
      <div className="relative ml-8 h-full min-h-[240px] border-b border-l border-[var(--admin-border)]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="100"
            x2={lineX2}
            y2={lineY2}
            stroke="var(--admin-outline)"
            strokeDasharray="4 4"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <p className="absolute left-3 top-3 rounded bg-[color-mix(in_srgb,var(--admin-surface)_80%,transparent)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
          Low volume, high value
        </p>
        <p className="absolute bottom-3 right-3 rounded bg-[color-mix(in_srgb,var(--admin-surface)_80%,transparent)] px-2 py-1 text-[12px] text-[var(--admin-on-surface-variant)]">
          High volume, low value
        </p>
        {board.sources.map((row) => {
          const left = xOf(row.events);
          const bottom = (row.revenueMajor / maxRevenue) * 100;
          const size =
            row.pattern === "low-volume high-value"
              ? 12
              : row.pattern === "high-volume low-value"
                ? 11
                : 9;
          const active = activeId === row.id || hoverId === row.id;
          return (
            <button
              key={row.id}
              type="button"
              className="absolute -translate-x-1/2 translate-y-1/2 rounded-full outline-none transition-transform duration-150 hover:scale-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
              style={{
                left: `${String(left)}%`,
                bottom: `${String(bottom)}%`,
                width: size,
                height: size,
                backgroundColor: sourceFill(row, board),
                opacity: active || !activeId ? 0.95 : 0.35,
                zIndex: active ? 2 : 1,
              }}
              aria-label={`${row.label}: ${formatInsightNumber(row.events)} events, ${formatInsightMoneyWithCode(row.revenueMajor, board.currency)}`}
              onMouseEnter={() => {
                setHoverId(row.id);
              }}
              onMouseLeave={() => {
                setHoverId(null);
              }}
              onFocus={() => {
                setHoverId(row.id);
              }}
              onBlur={() => {
                setHoverId(null);
              }}
              onClick={() => {
                onSelect(row.id);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row.id);
                }
              }}
            />
          );
        })}
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 font-data text-[11px] text-[var(--admin-on-surface)] shadow-sm"
            style={{
              left: `min(${String(xOf(hover.events))}%, calc(100% - 8rem))`,
              bottom: `min(${String((hover.revenueMajor / maxRevenue) * 100 + 6)}%, calc(100% - 2.5rem))`,
            }}
          >
            {hover.label}
            <span className="ml-2 text-[var(--admin-on-surface-variant)]">
              {formatInsightNumber(hover.events)} / {formatInsightMoney(hover.revenueMajor)}
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-center text-[12px] text-[var(--admin-on-surface-variant)]">
        Events volume
      </p>
    </div>
  );
}

function RankedList({
  board,
  activeId,
  onSelect,
}: {
  board: InsightSalesAttributionBoard;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const ranked = useMemo(() => {
    return board.sources
      .filter((row) => row.revenuePerEvent != null)
      .slice()
      .sort((left, right) => (right.revenuePerEvent ?? 0) - (left.revenuePerEvent ?? 0));
  }, [board.sources]);
  const maxRate = Math.max(...ranked.map((row) => row.revenuePerEvent ?? 0), 1);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {ranked.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No sources yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {ranked.map((row) => {
            const width = ((row.revenuePerEvent ?? 0) / maxRate) * 100;
            const active = activeId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full rounded-md px-1 py-1 text-left outline-none transition-colors duration-150 hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${active ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]" : ""}`}
                  onClick={() => {
                    onSelect(row.id);
                  }}
                >
                  <div className="mb-1 flex items-end justify-between gap-3">
                    <span className="font-data text-[12px] text-[var(--admin-on-surface)]">
                      {row.label}
                    </span>
                    <span className="font-data text-[12px] font-medium text-[var(--admin-on-surface)]">
                      {row.revenuePerEvent == null ? "-" : formatInsightMoney(row.revenuePerEvent)}{" "}
                      <span className="text-[10px] font-normal text-[var(--admin-on-surface-variant)]">
                        {board.currency}
                      </span>
                    </span>
                  </div>
                  <ShareBar pct={width} fill={sourceFill(row, board)} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function compareSources(
  left: InsightSalesAttributionSource,
  right: InsightSalesAttributionSource,
  key: SortKey,
): number {
  if (key === "source") return left.label.localeCompare(right.label);
  if (key === "events") return left.events - right.events;
  if (key === "revenue") return left.revenueMajor - right.revenueMajor;
  if (key === "share") return (left.revenueSharePct ?? -1) - (right.revenueSharePct ?? -1);
  return (left.revenuePerEvent ?? -1) - (right.revenuePerEvent ?? -1);
}

export function SalesInsightAttributionView({
  slug,
  sectionTitle,
  board,
  loading,
  error,
  onRefresh,
}: SalesInsightAttributionViewProps) {
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const csv = useMemo(() => (board ? attributionCsv(board) : ""), [board]);
  const namedIds = useMemo(
    () =>
      new Set(
        (board?.composition ?? [])
          .filter((segment) => segment.kind === "source")
          .map((segment) => segment.id),
      ),
    [board],
  );

  const filtered = useMemo(() => {
    if (!board) return [];
    const needle = query.trim().toLowerCase();
    return board.sources.filter((row) => {
      if (needle && !row.label.toLowerCase().includes(needle)) return false;
      if (segmentId === "unattributed") return false;
      if (segmentId === "other") return !namedIds.has(row.id);
      if (segmentId) return row.id === segmentId;
      return true;
    });
  }, [board, namedIds, query, segmentId]);

  const sorted = useMemo(() => {
    const rows = filtered.slice().sort((left, right) => compareSources(left, right, sortKey));
    if (sortDir === "desc") rows.reverse();
    return rows;
  }, [filtered, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const onCopy = () => {
    if (!csv) return;
    void copyText(csv).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "source" ? "asc" : "desc");
  };

  const toggleSegment = (id: string) => {
    setSegmentId((current) => (current === id ? null : id));
    setPage(0);
  };

  return (
    <div className={insightPageClassName} aria-busy={loading}>
      <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          Insights
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          {sectionTitle}
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-medium text-[var(--admin-on-surface)]">Attribution</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Link
              href={adminInsightHref(slug)}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Back to Sales Insight"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className={insightPageTitleClassName}>{board?.title ?? "Attribution"}</h1>
          </div>
          <p className={insightPageDescClassName}>
            Which sources bring events, and what revenue is attributed to them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={onCopy}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy as CSV"}
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board}
            onClick={() => {
              if (!csv) return;
              downloadCsv("sales-attribution.csv", csv);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link
            href={board?.reportHref ?? "/admin/reports/sales-marketing"}
            prefetch={false}
            className={insightPrimaryButtonClassName}
          >
            Open Reports
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? <ErrorStrip message={error} onRetry={onRefresh} /> : null}
      {loading && !board ? <AttributionSkeleton /> : null}

      {board ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{board.caveat}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-6">
            <section className="flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:col-span-2">
              <span className={insightKpiLabelClassName}>Attributed revenue</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={insightKpiValueClassName}>
                  {board.empty ? "0.00" : formatInsightMoney(board.attributedRevenue)}
                </span>
                <span className="font-data text-[12px] text-[var(--admin-on-surface-variant)]">
                  {board.currency}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-1.5">
                <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {board.attributedSharePct == null
                    ? "No paid revenue yet"
                    : `${formatInsightNumber(board.attributedSharePct, 1)}% of total revenue`}
                </span>
                <ShareBar pct={board.attributedSharePct} />
              </div>
            </section>
            <section className="flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <span className={insightKpiLabelClassName}>Events</span>
              <div className={`${insightKpiValueClassName} mt-2`}>
                {board.empty ? "0" : formatInsightNumber(board.events)}
              </div>
              <p className="mt-4 text-[12px] text-[var(--admin-on-surface-variant)]">
                First-touch tracked events
              </p>
            </section>
            <section className="flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <span className={insightKpiLabelClassName}>Sources</span>
              <div className={`${insightKpiValueClassName} mt-2`}>
                {board.empty ? "0" : formatInsightNumber(board.sourceCount)}
              </div>
              <p className="mt-4 text-[12px] text-[var(--admin-on-surface-variant)]">
                {board.empty
                  ? "None above 1% of revenue"
                  : `${formatInsightNumber(board.sourcesAbove1Pct)} above 1% of revenue`}
              </p>
            </section>
            <section className="flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <span className={insightKpiLabelClassName}>Revenue per event</span>
              <div className={`${insightKpiValueClassName} mt-2`}>
                {board.revenuePerEvent == null ? "-" : formatInsightMoney(board.revenuePerEvent)}
              </div>
              <p className="mt-4 text-[12px] text-[var(--admin-on-surface-variant)]">
                {board.revenuePerEvent == null ? "Needs attributed events" : board.currency}
              </p>
            </section>
            <section className="flex flex-col justify-between rounded-xl border border-[var(--admin-border)] border-t-2 border-t-[var(--admin-warning)] bg-[var(--admin-surface)] p-5">
              <span className={insightKpiLabelClassName}>Unattributed</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`${insightKpiValueClassName} text-[var(--admin-warning)]`}>
                  {formatInsightMoney(board.unattributedRevenue)}
                </span>
                <span className="font-data text-[12px] text-[var(--admin-on-surface-variant)]">
                  {board.currency}
                </span>
              </div>
              <p className="mt-4 flex items-center gap-1 text-[12px] text-[var(--admin-warning)]">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                No source recorded
              </p>
            </section>
          </div>

          <section className={`${insightPanelClassName} p-6`} aria-label="Source composition">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Source composition
              </h2>
              <span className="text-sm text-[var(--admin-on-surface-variant)]">
                By attributed revenue
              </span>
            </div>
            {board.empty || board.composition.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center rounded-md border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-center">
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">No sources yet</p>
                <p className="mt-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                  Composition appears after the first attributed event.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="flex h-8 overflow-hidden rounded-md bg-[var(--admin-surface-high)]"
                  role="img"
                  aria-label="Attributed revenue composition"
                >
                  {board.composition.map((segment, index) => (
                    <button
                      key={segment.id}
                      type="button"
                      title={`${segment.label}: ${segment.sharePct == null ? "-" : `${formatInsightNumber(segment.sharePct, 1)}%`}`}
                      className={`h-full outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/40 ${segmentId === segment.id ? "opacity-100" : segmentId ? "opacity-40" : ""}`}
                      style={{
                        width: `${String(Math.max(segment.sharePct ?? 0, 2))}%`,
                        backgroundColor: compositionFill(segment, index),
                      }}
                      onClick={() => {
                        toggleSegment(segment.id);
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[var(--admin-on-surface-variant)]">
                  {board.composition.map((segment, index) => (
                    <button
                      key={segment.id}
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 outline-none hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${segmentId === segment.id ? "text-[var(--admin-on-surface)]" : ""} ${segment.kind === "unattributed" ? "ml-auto" : ""}`}
                      onClick={() => {
                        toggleSegment(segment.id);
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: compositionFill(segment, index) }}
                        aria-hidden="true"
                      />
                      <span className={segment.kind === "source" ? "font-data" : ""}>
                        {segment.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section
              className={`${insightPanelClassName} hidden h-[400px] p-6 lg:col-span-7 lg:flex`}
              aria-label="Events against revenue"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Events against revenue
                </h2>
                <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {board.caption}
                </p>
              </div>
              {board.empty ? (
                <div className="flex flex-1 items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
                  {board.caption}
                </div>
              ) : (
                <ScatterPlot board={board} activeId={segmentId} onSelect={toggleSegment} />
              )}
            </section>
            <section
              className={`${insightPanelClassName} h-[400px] p-6 lg:col-span-5`}
              aria-label="Revenue per event"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Revenue per event
                </h2>
                <span className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                  Avg:{" "}
                  {board.revenuePerEvent == null
                    ? "-"
                    : `${formatInsightMoney(board.revenuePerEvent)} ${board.currency}`}
                </span>
              </div>
              <RankedList board={board} activeId={segmentId} onSelect={toggleSegment} />
            </section>
          </div>

          <section className={insightPanelClassName} aria-label="Source breakdown">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Source breakdown
              </h2>
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="sr-only">Filter sources</span>
                <input
                  className="h-8 w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-[12px] text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 sm:w-48"
                  placeholder="Filter sources..."
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                />
              </label>
            </div>
            {board.empty ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <p className="text-base font-semibold text-[var(--admin-on-surface)]">
                  {board.caption}
                </p>
                <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  Sources come from tracked visits. Open Marketing Insight to review campaign
                  capture.
                </p>
                <Link
                  href={board.trackingHref}
                  prefetch={false}
                  className={`${insightPrimaryButtonClassName} mt-6`}
                >
                  Open Marketing Insight
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className={insightTableHeadClassName}>
                        <SortHeader
                          label="Source"
                          active={sortKey === "source"}
                          dir={sortDir}
                          onClick={() => {
                            toggleSort("source");
                          }}
                        />
                        <SortHeader
                          label="Events"
                          active={sortKey === "events"}
                          dir={sortDir}
                          align="right"
                          onClick={() => {
                            toggleSort("events");
                          }}
                        />
                        <SortHeader
                          label="Attributed revenue"
                          active={sortKey === "revenue"}
                          dir={sortDir}
                          align="right"
                          onClick={() => {
                            toggleSort("revenue");
                          }}
                        />
                        <SortHeader
                          label="Share"
                          active={sortKey === "share"}
                          dir={sortDir}
                          onClick={() => {
                            toggleSort("share");
                          }}
                        />
                        <SortHeader
                          label="Rev/event"
                          active={sortKey === "rate"}
                          dir={sortDir}
                          align="right"
                          onClick={() => {
                            toggleSort("rate");
                          }}
                        />
                        <th className="w-12 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row) => {
                        const maxEvents = Math.max(board.maxEvents, 1);
                        const eventBar = (row.events / maxEvents) * 100;
                        const active = segmentId === row.id;
                        return (
                          <tr
                            key={row.id}
                            className={`${insightTableRowClassName} ${active ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]" : ""}`}
                          >
                            <td className="relative px-4 py-2 font-data text-sm text-[var(--admin-on-surface)]">
                              {active ? (
                                <span
                                  className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-primary)]"
                                  aria-hidden="true"
                                />
                              ) : null}
                              <div className="flex flex-wrap items-center gap-2">
                                {row.label}
                                <PatternPill pattern={row.pattern} />
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-data text-sm">
                                  {formatInsightNumber(row.events)}
                                </span>
                                <div className="w-16">
                                  <ShareBar pct={eventBar} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-data text-sm">
                              {formatInsightMoney(row.revenueMajor)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16">
                                  <ShareBar
                                    pct={row.revenueSharePct}
                                    fill={sourceFill(row, board)}
                                  />
                                </div>
                                <span className="font-data text-[12px] text-[var(--admin-on-surface-variant)]">
                                  {row.revenueSharePct == null
                                    ? "-"
                                    : `${formatInsightNumber(row.revenueSharePct, 1)}%`}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                              {row.revenuePerEvent == null
                                ? "-"
                                : formatInsightMoney(row.revenuePerEvent)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Link
                                href={row.href}
                                prefetch={false}
                                className="inline-flex rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                                aria-label={`Open sales report for ${row.label}`}
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {board.unattributedRevenue > 0 &&
                      (segmentId == null || segmentId === "unattributed") &&
                      !query.trim() ? (
                        <tr
                          className={`${insightTableRowClassName} bg-[color-mix(in_srgb,var(--admin-warning)_6%,transparent)]`}
                        >
                          <td className="px-4 py-2 font-data text-sm italic text-[var(--admin-on-surface-variant)]">
                            unattributed
                          </td>
                          <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                            -
                          </td>
                          <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-warning)]">
                            {formatInsightMoney(board.unattributedRevenue)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <ShareBar
                                  pct={
                                    board.totalRevenue > 0
                                      ? Math.round(
                                          (board.unattributedRevenue / board.totalRevenue) * 1000,
                                        ) / 10
                                      : null
                                  }
                                  fill="var(--admin-warning)"
                                />
                              </div>
                              <span className="font-data text-[12px] text-[var(--admin-warning)]">
                                {board.totalRevenue > 0
                                  ? `${formatInsightNumber(Math.round((board.unattributedRevenue / board.totalRevenue) * 1000) / 10, 1)}%`
                                  : "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-data text-sm text-[var(--admin-on-surface-variant)]">
                            -
                          </td>
                          <td className="px-4 py-2" />
                        </tr>
                      ) : null}
                      {pageRows.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                            colSpan={6}
                          >
                            No sources match this filter.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
                  <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
                    {sorted.length === 0
                      ? "Showing 0 sources"
                      : `Showing ${String(safePage * PAGE_SIZE + 1)}-${String(Math.min((safePage + 1) * PAGE_SIZE, sorted.length))} of ${String(sorted.length)} sources`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                      disabled={safePage <= 0}
                      aria-label="Previous page"
                      onClick={() => {
                        setPage((current) => Math.max(current - 1, 0));
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                      disabled={safePage >= pageCount - 1}
                      aria-label="Next page"
                      onClick={() => {
                        setPage((current) => Math.min(current + 1, pageCount - 1));
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "right" | undefined;
  onClick: () => void;
}) {
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 uppercase outline-none hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${active ? "text-[var(--admin-on-surface)]" : ""} ${align === "right" ? "ml-auto" : ""}`}
        onClick={onClick}
      >
        {label}
        {active ? (
          <ArrowDown
            className={`h-3.5 w-3.5 ${dir === "asc" ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        ) : null}
      </button>
    </th>
  );
}
