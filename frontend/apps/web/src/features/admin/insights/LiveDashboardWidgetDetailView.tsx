"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowUpRight, Search } from "lucide-react";
import type { InsightWidget, InsightWidgetDetail } from "./admin-insights-api";
import { formatInsightNumber } from "./admin-insights-format";
import {
  insightKpiValueClassName,
  insightPrimaryButtonClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  cell,
  ChartLegend,
  DeltaReading,
  DetailPanel,
  EmptyCanvas,
  exportColumns,
  formatAmount,
  HeadlineCell,
  HeadlineDivider,
  HeadlineStrip,
  InsightNote,
  isKpiWidget,
  isMeasureColumn,
  KpiValueTable,
  LEGEND_AVERAGE_SWATCH,
  numericValue,
  RelatedRail,
  SeriesTable,
  SplitBreakdown,
  StatusPill,
  statusPillClass,
  stringValue,
  UnderlyingDataToggle,
  UnderlyingTable,
  useWidgetState,
  widgetMetadata,
  type InsightRow,
} from "./insight-detail-kit";
import { SeriesChart, seriesPoints, type ChartSeries } from "./insight-detail-charts";
import {
  InsightWidgetDetailView,
  type DetailCanvas,
  type DetailViz,
  type InsightDetailArea,
  type InsightWidgetDetailViewProps,
} from "./InsightWidgetDetailView";
import {
  LIVE_ATTENDANCE_REPORT_HREF,
  LIVE_DUAL_SERIES_IDS,
  LIVE_FIXED_WINDOW_CAPTION,
  LIVE_PERCENT_KPI_IDS,
  LIVE_SESSIONS_HREF,
  LIVE_STATUS_BAR_IDS,
  LIVE_TABLE_IDS,
  liveAttendanceRateTone,
  liveStatusBarTone,
  liveStatusShortLabel,
} from "./live-dashboard-meta";

type StatusPairRow = { label: string; sessions: number; attendees: number };

const ATTENDANCE_SERIES: ChartSeries[] = [
  {
    key: "registered",
    label: "Registered",
    color: "var(--admin-primary-container)",
    strokeWidth: 2,
  },
  { key: "attended", label: "Attended", color: "var(--admin-primary)" },
];

const REPORT_ACTION = { href: LIVE_ATTENDANCE_REPORT_HREF, label: "Open Live Class Attendance" };

function measureKey(widget: InsightWidget): string {
  if (LIVE_DUAL_SERIES_IDS.has(widget.id)) return "attended";
  return widget.data.measures?.[0] ?? "value";
}

function widgetHasNoEvents(widget: InsightWidget): boolean {
  if (widget.data.rows.length === 0) return true;
  if (LIVE_DUAL_SERIES_IDS.has(widget.id)) {
    return widget.data.rows.every(
      (row) =>
        numericValue(cell(row, "attended")) <= 0 && numericValue(cell(row, "registered")) <= 0,
    );
  }
  if (LIVE_TABLE_IDS.has(widget.id)) return false;
  if (LIVE_STATUS_BAR_IDS.has(widget.id)) {
    return widget.data.rows.every((row) => numericValue(cell(row, "value")) <= 0);
  }
  const key = measureKey(widget);
  return widget.data.rows.every((row) => numericValue(cell(row, key)) === 0);
}

function formatMetric(value: number, widgetId: string): string {
  if (LIVE_PERCENT_KPI_IDS.has(widgetId)) return `${formatInsightNumber(value)}%`;
  return formatAmount(value);
}

function vizOptions(widget: InsightWidget): DetailViz[] {
  if (LIVE_TABLE_IDS.has(widget.id) || isKpiWidget(widget)) return ["table"];
  if (LIVE_STATUS_BAR_IDS.has(widget.id)) return ["bar", "table"];
  return ["line", "area", "bar", "table"];
}

function statusFillClass(tone: ReturnType<typeof liveStatusBarTone>): string {
  if (tone === "success") return "bg-[var(--admin-success)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-outline)]";
}

function rateBarClass(tone: ReturnType<typeof liveAttendanceRateTone>): string {
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "success") return "bg-[var(--admin-success)]";
  return "bg-[var(--admin-primary)]";
}

function relatedBadge(href: string): string {
  if (href.includes("/reports/") || href === LIVE_ATTENDANCE_REPORT_HREF) return "REPORT";
  return "DASHBOARD";
}

/** One row per status, with the session count and the attendee count side by side. */
function mergeStatusPairs(
  primary: InsightWidget,
  paired: InsightWidget | null | undefined,
): StatusPairRow[] {
  const sessionsSource = primary.id === "sessions-by-status" ? primary : (paired ?? primary);
  const attendeesSource = primary.id === "attended-by-status" ? primary : (paired ?? null);
  const labels = new Set<string>();
  for (const row of sessionsSource.data.rows)
    labels.add(stringValue(cell(row, "label"), "Unknown"));
  for (const row of attendeesSource?.data.rows ?? []) {
    labels.add(stringValue(cell(row, "label"), "Unknown"));
  }
  const valueFor = (source: InsightWidget | null, label: string) =>
    numericValue(
      cell(
        source?.data.rows.find((row) => stringValue(cell(row, "label")) === label),
        "value",
      ),
    );
  return [...labels].map((label) => ({
    label,
    sessions: valueFor(sessionsSource, label),
    attendees: valueFor(attendeesSource, label),
  }));
}

function StatusCompareChart({ rows }: { rows: StatusPairRow[] }) {
  const max = Math.max(...rows.flatMap((row) => [row.sessions, row.attendees]), 1);
  return (
    <div className="flex flex-col gap-5 p-5">
      <ChartLegend
        items={[
          { label: "Sessions (L)", swatch: "h-3 w-3 rounded-sm bg-[var(--admin-primary)]" },
          {
            label: "Attendees (R)",
            swatch: "h-3 w-3 rounded-sm bg-[var(--admin-primary-container)]",
          },
        ]}
      />
      <div className="flex flex-col gap-4">
        {rows.map((row) => {
          const tone = liveStatusBarTone(row.label);
          return (
            <div key={row.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <StatusPill tone={tone}>{liveStatusShortLabel(row.label)}</StatusPill>
                <span className="font-data text-xs text-[var(--admin-on-surface-variant)]">
                  {`${formatInsightNumber(row.sessions)} / ${formatInsightNumber(row.attendees)}`}
                </span>
              </div>
              <div className="flex h-8 items-stretch gap-1.5">
                {[
                  { value: row.sessions, fill: statusFillClass(tone) },
                  { value: row.attendees, fill: "bg-[var(--admin-primary-container)]" },
                ].map((bar, index) => (
                  <div
                    key={index}
                    className="flex flex-1 items-center rounded bg-[var(--admin-surface-low)]"
                  >
                    <div
                      className={`h-full rounded ${bar.fill}`}
                      style={{
                        width: `${String(Math.max((bar.value / max) * 100, bar.value > 0 ? 4 : 0))}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusSoloChart({ widget }: { widget: InsightWidget }) {
  const rows = widget.data.rows;
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);
  return (
    <div className="flex h-64 items-end gap-4 px-5 pb-5 pt-8">
      {rows.map((row, index) => {
        const label = stringValue(cell(row, "label"), "Unknown");
        const value = numericValue(cell(row, "value"));
        const heightPct = Math.max((value / max) * 100, value > 0 ? 10 : 3);
        return (
          <div
            key={`${label}-${String(index)}`}
            className="flex h-full flex-1 flex-col items-center gap-2"
          >
            <span className="font-data text-sm text-[var(--admin-on-surface)]">
              {value > 0 ? formatInsightNumber(value) : "-"}
            </span>
            <div className="flex w-full flex-1 items-end justify-center rounded-t bg-[var(--admin-surface-low)]">
              <div
                className={`w-8 rounded-t ${statusFillClass(liveStatusBarTone(label))}`}
                style={{ height: `${String(heightPct)}%` }}
              />
            </div>
            <span className="text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              {liveStatusShortLabel(label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SessionDetailTable({
  widget,
  selectedIndex,
  onSelect,
  query,
  onQueryChange,
}: {
  widget: InsightWidget;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const columns = exportColumns(widget);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const indexed = widget.data.rows.map((row, index) => ({ row, index }));
    if (!needle) return indexed;
    return indexed.filter(({ row }) =>
      columns.some((column) => stringValue(cell(row, column.key)).toLowerCase().includes(needle)),
    );
  }, [columns, query, widget.data.rows]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3">
        <Search className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          placeholder="Filter sessions"
          className="h-9 w-full bg-transparent text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
          aria-label="Filter sessions"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className={insightTableHeadClassName}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 ${isMeasureColumn(column) ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                >
                  No sessions match this filter.
                </td>
              </tr>
            ) : (
              filtered.map(({ row, index }) => {
                const selected = selectedIndex === index;
                return (
                  <tr
                    key={`${stringValue(cell(row, "title"), "row")}-${String(index)}`}
                    className={`${insightTableRowClassName} cursor-pointer ${
                      selected
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                        : ""
                    }`}
                    onClick={() => {
                      onSelect(index);
                    }}
                    aria-selected={selected}
                  >
                    {columns.map((column) => {
                      const raw = cell(row, column.key);
                      if (column.key === "status") {
                        const status = stringValue(raw, "-");
                        return (
                          <td key={column.key} className="px-4 py-3">
                            <StatusPill tone={liveStatusBarTone(status)}>
                              {liveStatusShortLabel(status)}
                            </StatusPill>
                          </td>
                        );
                      }
                      if (column.key === "rate") {
                        const rate = numericValue(raw);
                        return (
                          <td key={column.key} className="px-4 py-3">
                            <div className="ml-auto flex w-28 flex-col items-end gap-1">
                              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                                {`${formatInsightNumber(rate)}%`}
                              </span>
                              <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                <div
                                  className={`h-full ${rateBarClass(liveAttendanceRateTone(rate))}`}
                                  style={{ width: `${String(Math.min(Math.max(rate, 0), 100))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        );
                      }
                      const measure = isMeasureColumn(column);
                      return (
                        <td
                          key={column.key}
                          className={`px-4 py-3 text-sm text-[var(--admin-on-surface)] ${
                            measure ? "text-right font-data" : ""
                          }`}
                        >
                          {measure ? formatInsightNumber(numericValue(raw)) : stringValue(raw, "-")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
        <Link
          href={LIVE_ATTENDANCE_REPORT_HREF}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
        >
          {REPORT_ACTION.label}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <span className="font-data text-xs text-[var(--admin-on-surface-variant)]">
          {`${String(filtered.length)} of ${String(widget.data.rows.length)} ${widget.data.rows.length === 1 ? "row" : "rows"}`}
        </span>
      </footer>
    </div>
  );
}

function StatusSplitsPanel({ rows }: { rows: StatusPairRow[] }) {
  return (
    <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="border-b border-[var(--admin-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Status splits</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className={`${insightTableHeadClassName} px-4 py-2.5`}>Status</th>
              <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Sessions</th>
              <th className={`${insightTableHeadClassName} px-4 py-2.5 text-right`}>Attendees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={insightTableRowClassName}>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(liveStatusBarTone(row.label))}`}
                  >
                    {liveStatusShortLabel(row.label)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-data text-sm">
                  {formatInsightNumber(row.sessions)}
                </td>
                <td className="px-4 py-2 text-right font-data text-sm">
                  {formatInsightNumber(row.attendees)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectedSessionRail({ row }: { row: InsightRow | null }) {
  if (!row) {
    return (
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-8 text-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Select a session row to inspect available fields.
        </p>
      </div>
    );
  }

  const number = (key: string) => formatInsightNumber(numericValue(cell(row, key)));
  const fields: Array<{ label: string; value: string } | null> = [
    stringValue(cell(row, "title"))
      ? { label: "Title", value: stringValue(cell(row, "title")) }
      : null,
    stringValue(cell(row, "status"))
      ? { label: "Status", value: liveStatusShortLabel(stringValue(cell(row, "status"))) }
      : null,
    cell(row, "attended") != null ? { label: "Attended", value: number("attended") } : null,
    cell(row, "registered") != null ? { label: "Registered", value: number("registered") } : null,
    cell(row, "rate") != null ? { label: "Rate", value: `${number("rate")}%` } : null,
    cell(row, "avgMin") != null ? { label: "Avg min", value: number("avgMin") } : null,
    cell(row, "scheduled") != null
      ? { label: "Scheduled", value: stringValue(cell(row, "scheduled"), "-") }
      : null,
  ];

  return (
    <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="border-b border-[var(--admin-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Selected session</h3>
      </header>
      <dl className="flex flex-col gap-3 p-4">
        {fields.map((field) =>
          field ? (
            <div key={field.label} className="flex items-start justify-between gap-3">
              <dt className="text-xs uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                {field.label}
              </dt>
              <dd className="text-right text-sm font-medium text-[var(--admin-on-surface)]">
                {field.value}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
    </section>
  );
}

function LowAttendanceIntervention() {
  return (
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-4">
      <div className="mb-2 flex items-center gap-2 text-[var(--admin-warning)]">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Low attendance risk</h3>
      </div>
      <p className="text-sm text-[var(--admin-on-surface)]">
        These sessions finished below the attendance threshold. Review scheduling, reminders, and
        capacity in live sessions.
      </p>
      <Link
        href={LIVE_SESSIONS_HREF}
        prefetch={false}
        className={`${insightPrimaryButtonClassName} mt-4 w-full`}
      >
        Open live sessions
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function VsPrevious({
  detail,
  text,
}: {
  detail: InsightWidgetDetail;
  text: (delta: number) => string;
}) {
  if (!detail.comparison) return null;
  return (
    <>
      <HeadlineDivider />
      <HeadlineCell label="Vs previous">
        <DeltaReading
          delta={detail.comparison.deltaAbs}
          text={text(detail.comparison.deltaAbs)}
          pct={detail.comparison.deltaPct}
        />
      </HeadlineCell>
    </>
  );
}

type LiveState = {
  comparePaired: boolean;
  selectedRow: number | null;
  onSelectRow: (index: number) => void;
  tableQuery: string;
  onTableQuery: (value: string) => void;
};

function LiveMain({ canvas, state }: { canvas: DetailCanvas; state: LiveState }) {
  const { detail, widget, viz, empty, range, copyCsv } = canvas;
  const dash = (value: string) => (empty ? "-" : value);

  if (LIVE_DUAL_SERIES_IDS.has(widget.id)) {
    const points = seriesPoints(widget, range, ["attended", "registered"]);
    const attended = points.reduce((sum, point) => sum + (point.values["attended"] ?? 0), 0);
    const registered =
      detail.secondaryTotal ??
      points.reduce((sum, point) => sum + (point.values["registered"] ?? 0), 0);
    return (
      <>
        <HeadlineStrip>
          <HeadlineCell label="Total attended">
            <div className={insightKpiValueClassName}>{dash(formatInsightNumber(attended))}</div>
          </HeadlineCell>
          <HeadlineDivider from="md" />
          <HeadlineCell label="Total registered">
            <div className={insightKpiValueClassName}>{dash(formatInsightNumber(registered))}</div>
          </HeadlineCell>
          <VsPrevious detail={detail} text={(delta) => formatInsightNumber(delta)} />
          <HeadlineDivider />
          <HeadlineCell label="Avg daily">
            <span className="font-data text-sm text-[var(--admin-on-surface)]">
              {empty || detail.average == null ? "-" : formatAmount(detail.average)}
            </span>
          </HeadlineCell>
        </HeadlineStrip>
        <DetailPanel
          title={viz === "table" ? "Records" : "Daily attendance"}
          aside={
            viz !== "table" ? (
              <ChartLegend
                items={[
                  {
                    label: "Registered",
                    swatch: "h-3 w-3 rounded-full bg-[var(--admin-primary-container)]",
                  },
                  { label: "Attended", swatch: "h-3 w-3 rounded-full bg-[var(--admin-primary)]" },
                  ...(detail.average != null
                    ? [{ label: "Average", swatch: LEGEND_AVERAGE_SWATCH }]
                    : []),
                ]}
              />
            ) : null
          }
        >
          <div className="p-5">
            {empty ? (
              <EmptyCanvas
                title="No data available for this window"
                body="Attended and registered counts will plot here once live class activity starts."
                href={REPORT_ACTION.href}
                hrefLabel={REPORT_ACTION.label}
              />
            ) : viz === "table" ? (
              <SeriesTable points={points} series={ATTENDANCE_SERIES} />
            ) : (
              <SeriesChart
                points={points}
                series={ATTENDANCE_SERIES}
                mainKey="attended"
                viz={viz === "bar" ? "bar" : viz === "area" ? "area" : "line"}
                average={detail.average}
                widgetTitle={widget.title}
                tooltipWidth={168}
                tooltip={(point) => {
                  const pointAttended = point.values["attended"] ?? 0;
                  const pointRegistered = point.values["registered"] ?? 0;
                  return [
                    { text: point.longLabel, size: 10 },
                    { text: `Registered ${formatInsightNumber(pointRegistered)}` },
                    { text: `Attended ${formatInsightNumber(pointAttended)}`, strong: true },
                    {
                      text: `Gap (No-show) ${formatInsightNumber(Math.max(pointRegistered - pointAttended, 0))}`,
                      size: 10,
                    },
                  ];
                }}
              />
            )}
          </div>
          {detail.insightNote && !empty ? <InsightNote note={detail.insightNote} /> : null}
        </DetailPanel>
        <SplitBreakdown detail={detail} />
        {!empty && viz !== "table" ? (
          <UnderlyingDataToggle onCopyCsv={copyCsv}>
            <SeriesTable points={points} series={ATTENDANCE_SERIES} />
          </UnderlyingDataToggle>
        ) : null}
      </>
    );
  }

  if (LIVE_STATUS_BAR_IDS.has(widget.id)) {
    const pairs = mergeStatusPairs(widget, detail.pairedWidget);
    return (
      <>
        <HeadlineStrip>
          <HeadlineCell label="Total sessions">
            <div className={insightKpiValueClassName}>
              {dash(formatInsightNumber(pairs.reduce((sum, row) => sum + row.sessions, 0)))}
            </div>
          </HeadlineCell>
          <HeadlineDivider from="md" />
          <HeadlineCell label="Total attendees">
            <div className={insightKpiValueClassName}>
              {dash(
                formatInsightNumber(
                  detail.secondaryTotal ?? pairs.reduce((sum, row) => sum + row.attendees, 0),
                ),
              )}
            </div>
          </HeadlineCell>
        </HeadlineStrip>
        <DetailPanel title={viz === "table" ? "Records" : "Status breakdown"}>
          {empty ? (
            <EmptyCanvas
              title="No data available for this window"
              body="Status counts appear after live classes are scheduled or run."
              href={LIVE_SESSIONS_HREF}
              hrefLabel="Open live sessions"
            />
          ) : viz === "table" ? (
            <div className="p-5">
              <UnderlyingTable widget={widget} range={range} />
            </div>
          ) : state.comparePaired && detail.pairedWidget ? (
            <StatusCompareChart rows={pairs} />
          ) : (
            <StatusSoloChart widget={widget} />
          )}
        </DetailPanel>
        {!empty && viz !== "table" ? (
          <UnderlyingDataToggle onCopyCsv={copyCsv}>
            <UnderlyingTable widget={widget} range={range} />
          </UnderlyingDataToggle>
        ) : null}
      </>
    );
  }

  if (LIVE_TABLE_IDS.has(widget.id)) {
    const lowAttendance = widget.id === "low-attendance-sessions";
    const rates = widget.data.rows.map((row) => numericValue(cell(row, "rate")));
    const count = rates.length;
    return (
      <>
        {lowAttendance && !empty ? (
          <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-5 py-4">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                {`${formatInsightNumber(count)} low attendance ${count === 1 ? "session" : "sessions"}`}
              </p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {`Average attendance rate ${formatInsightNumber(count > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / count : 0, 1)}%.`}
              </p>
            </div>
          </div>
        ) : null}
        <DetailPanel title={widget.title}>
          {empty ? (
            <EmptyCanvas
              title="No data available for this window"
              body={
                widget.id === "upcoming-sessions"
                  ? "Nothing is scheduled in the near window."
                  : lowAttendance
                    ? "Sessions that finish below the attendance threshold will be listed here."
                    : "Ended and completed sessions will appear here after the first live class."
              }
              href={REPORT_ACTION.href}
              hrefLabel={REPORT_ACTION.label}
            />
          ) : (
            <SessionDetailTable
              widget={widget}
              selectedIndex={state.selectedRow}
              onSelect={state.onSelectRow}
              query={state.tableQuery}
              onQueryChange={state.onTableQuery}
            />
          )}
        </DetailPanel>
      </>
    );
  }

  const kpiValue = numericValue(
    cell(widget.data.rows[0], isKpiWidget(widget) ? "value" : measureKey(widget)),
  );
  return (
    <>
      <HeadlineStrip>
        <HeadlineCell label={widget.title}>
          <div className={insightKpiValueClassName}>{dash(formatMetric(kpiValue, widget.id))}</div>
        </HeadlineCell>
        <VsPrevious detail={detail} text={(delta) => formatMetric(delta, widget.id)} />
      </HeadlineStrip>
      <DetailPanel title="Value">
        {empty ? (
          <EmptyCanvas
            title="No data available for this window"
            body="This KPI will populate once live activity is recorded."
            href={REPORT_ACTION.href}
            hrefLabel={REPORT_ACTION.label}
          />
        ) : (
          <KpiValueTable label={widget.title} value={formatMetric(kpiValue, widget.id)} />
        )}
      </DetailPanel>
    </>
  );
}

export function LiveDashboardWidgetDetailView(props: InsightWidgetDetailViewProps) {
  const widget = props.detail?.widget ?? null;
  const [comparePaired, setComparePaired] = useWidgetState(
    widget,
    Boolean(props.detail?.pairedWidget),
  );
  const [selectedRow, setSelectedRow] = useWidgetState<number | null>(
    widget,
    widget && widget.data.rows.length > 0 ? 0 : null,
  );
  const [tableQuery, setTableQuery] = useWidgetState(widget, "");
  const state: LiveState = {
    comparePaired,
    selectedRow,
    onSelectRow: setSelectedRow,
    tableQuery,
    onTableQuery: setTableQuery,
  };

  const area: InsightDetailArea = {
    vizOptions,
    isEmpty: widgetHasNoEvents,
    primaryAction: () => REPORT_ACTION,
    skeletonHeadlines: 4,
    toolbarExtras:
      widget && LIVE_STATUS_BAR_IDS.has(widget.id) && props.detail?.pairedWidget ? (
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--admin-primary)]"
            checked={comparePaired}
            onChange={(event) => {
              setComparePaired(event.target.checked);
            }}
          />
          Compare with paired widget
        </label>
      ) : null,
    renderMain: (canvas) => <LiveMain canvas={canvas} state={state} />,
    renderRail: ({ detail, widget: current, empty }) => {
      const table = LIVE_TABLE_IDS.has(current.id) && !empty;
      const status = LIVE_STATUS_BAR_IDS.has(current.id) && !empty;
      return (
        <RelatedRail
          related={detail.related}
          badge={relatedBadge}
          emptyAction={{ href: REPORT_ACTION.href, label: "Historical Attendance" }}
          metadata={widgetMetadata(detail, LIVE_FIXED_WINDOW_CAPTION)}
          before={
            table ? (
              <SelectedSessionRail
                row={selectedRow != null ? (current.data.rows[selectedRow] ?? null) : null}
              />
            ) : status ? (
              <StatusSplitsPanel rows={mergeStatusPairs(current, detail.pairedWidget)} />
            ) : null
          }
          after={
            current.id === "low-attendance-sessions" && !empty ? (
              <LowAttendanceIntervention />
            ) : null
          }
        />
      );
    },
  };

  return <InsightWidgetDetailView {...props} area={area} />;
}
