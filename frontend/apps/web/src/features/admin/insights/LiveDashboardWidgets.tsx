"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { CalendarClock, Inbox, Maximize2, Radio, Users } from "lucide-react";
import { LineChartView } from "../../analytics/viz/charts";
import { adminInsightWidgetHref } from "./admin-insights-catalog";
import type { InsightWidget } from "./admin-insights-api";
import { formatInsightNumber } from "./admin-insights-format";
import {
  insightKpiValueClassName,
  insightPanelClassName,
  insightShimmerClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";
import {
  LIVE_ATTENDANCE_KPI_IDS,
  LIVE_LEARNER_DETAIL_CAPTION,
  LIVE_PERCENT_KPI_IDS,
  LIVE_SESSION_KPI_IDS,
  LIVE_STATUS_BAR_IDS,
  LIVE_TABLE_IDS,
  LIVE_WATCH_KPI_IDS,
  liveStatusBarTone,
  liveStatusShortLabel,
} from "./live-dashboard-meta";

function numericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: string | number | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function cell(
  row: Record<string, string | number | null> | undefined,
  key: string,
): string | number | null {
  return row?.[key] ?? null;
}

function kpiMap(widgets: InsightWidget[]): Map<string, InsightWidget> {
  return new Map(widgets.map((widget) => [widget.id, widget]));
}

function kpiNumber(byId: Map<string, InsightWidget>, id: string): number {
  return numericValue(cell(byId.get(id)?.data.rows[0], "value"));
}

function statusFillClass(tone: ReturnType<typeof liveStatusBarTone>): string {
  if (tone === "success") return "bg-[var(--admin-success)]";
  if (tone === "warning") return "bg-[var(--admin-warning)]";
  if (tone === "danger") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-outline)]";
}

function statusPillClass(tone: ReturnType<typeof liveStatusBarTone>): string {
  if (tone === "success") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (tone === "warning") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  if (tone === "danger") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function WidgetEmpty({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">{title}</h4>
      <p className="mt-1 max-w-[240px] text-xs text-[var(--admin-on-surface-variant)]">{body}</p>
    </div>
  );
}

function LiveKpiRow({
  label,
  value,
  href,
  trailing,
  live,
  percent,
}: {
  label: string;
  value: string;
  href: string;
  trailing?: ReactNode;
  live?: boolean;
  percent?: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] py-2.5 last:border-b-0">
      <span className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
        {label}
        {live ? (
          <span
            className="inline-flex h-2 w-2 rounded-full bg-[var(--admin-success)] motion-safe:animate-pulse"
            aria-hidden="true"
          />
        ) : null}
      </span>
      <div className="flex min-w-0 flex-col items-end gap-1">
        {percent != null ? (
          <div className="flex items-center gap-2">
            <div className="h-[3px] w-20 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
              <div
                className="h-full bg-[var(--admin-primary)]"
                style={{ width: `${String(Math.min(Math.max(percent, 0), 100))}%` }}
              />
            </div>
            <Link
              href={href}
              prefetch={false}
              className="font-data text-lg font-semibold tracking-tight text-[var(--admin-on-surface)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            >
              {value}
            </Link>
          </div>
        ) : (
          <Link
            href={href}
            prefetch={false}
            className="font-data text-xl font-semibold tracking-tight text-[var(--admin-on-surface)] outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            {value}
          </Link>
        )}
        {trailing}
      </div>
    </div>
  );
}

function LiveKpiGroupCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
      aria-label={title}
    >
      <h3 className="mb-3 text-sm font-semibold text-[var(--admin-on-surface-variant)]">{title}</h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export function LiveDashboardKpiGroups({
  widgets,
  slug,
  generatedAtLabel,
  muted = false,
}: {
  widgets: InsightWidget[];
  slug: string;
  generatedAtLabel?: string | undefined;
  muted?: boolean;
}) {
  const byId = useMemo(() => kpiMap(widgets), [widgets]);
  const hasAny =
    LIVE_SESSION_KPI_IDS.some((id) => byId.has(id)) ||
    LIVE_ATTENDANCE_KPI_IDS.some((id) => byId.has(id)) ||
    LIVE_WATCH_KPI_IDS.some((id) => byId.has(id));
  if (!hasAny) return null;

  const formatKpi = (id: string): string => {
    const value = kpiNumber(byId, id);
    if (LIVE_PERCENT_KPI_IDS.has(id)) {
      if (muted && value <= 0) return "-";
      return `${formatInsightNumber(value)}%`;
    }
    return formatInsightNumber(value);
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <LiveKpiGroupCard title="Sessions">
        {LIVE_SESSION_KPI_IDS.map((id) => {
          const widget = byId.get(id);
          if (!widget) return null;
          return (
            <LiveKpiRow
              key={id}
              label={widget.title.replace(/^Ended sessions$/i, "Ended")}
              value={formatKpi(id)}
              href={adminInsightWidgetHref(slug, id)}
              live={id === "live-now" && kpiNumber(byId, id) > 0}
              trailing={
                id === "live-now" && generatedAtLabel ? (
                  <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                    {`as of ${generatedAtLabel}`}
                  </span>
                ) : null
              }
            />
          );
        })}
      </LiveKpiGroupCard>

      <LiveKpiGroupCard title="Attendance">
        {LIVE_ATTENDANCE_KPI_IDS.map((id) => {
          const widget = byId.get(id);
          if (!widget) return null;
          const raw = kpiNumber(byId, id);
          return (
            <LiveKpiRow
              key={id}
              label={widget.title
                .replace(/ \(30d\)$/i, " 30d")
                .replace(/^Attendance rate %$/i, "Rate %")}
              value={formatKpi(id)}
              href={adminInsightWidgetHref(slug, id)}
              percent={LIVE_PERCENT_KPI_IDS.has(id) && !(muted && raw <= 0) ? raw : null}
            />
          );
        })}
      </LiveKpiGroupCard>

      <LiveKpiGroupCard title="Watch Time">
        {LIVE_WATCH_KPI_IDS.map((id) => {
          const widget = byId.get(id);
          if (!widget) return null;
          return (
            <LiveKpiRow
              key={id}
              label={widget.title
                .replace(/^Avg watch \(min\)$/i, "Avg min")
                .replace(/^Total watch \(hrs\)$/i, "Total hrs")
                .replace(/^Sessions \(30d\)$/i, "Sessions 30d")
                .replace(/^Attended \(30d\)$/i, "Attended 30d")}
              value={formatKpi(id)}
              href={adminInsightWidgetHref(slug, id)}
            />
          );
        })}
      </LiveKpiGroupCard>

      <div className="flex items-end justify-end rounded p-4 md:col-span-2 xl:col-span-1">
        <p className="max-w-[16rem] text-right text-xs text-[var(--admin-on-surface-variant)]">
          {LIVE_LEARNER_DETAIL_CAPTION}
        </p>
      </div>
    </div>
  );
}

function StatusBarChart({ widget, slug }: { widget: InsightWidget; slug: string }) {
  const rows = widget.data.rows;
  const max = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);
  const isAttendance = widget.id === "attended-by-status";

  if (rows.length === 0) {
    return (
      <WidgetEmpty
        title="No session status data"
        body="Status breakdown appears after live classes are scheduled or run."
        icon={<Radio className="h-7 w-7" aria-hidden="true" />}
      />
    );
  }

  return (
    <section className={`${insightPanelClassName} min-h-[320px]`} aria-label={widget.title}>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          <Link
            href={adminInsightWidgetHref(slug, widget.id)}
            prefetch={false}
            className="outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            {widget.title}
          </Link>
        </h3>
        <Link
          href={`${adminInsightWidgetHref(slug, widget.id)}?overlay=1`}
          prefetch={false}
          className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Open ${widget.title} overlay`}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      <div className="relative flex flex-1 flex-col justify-end gap-4 p-4">
        {isAttendance && widget.footnote ? (
          <p className="absolute right-4 top-4 max-w-[12rem] text-right text-[11px] text-[var(--admin-on-surface-variant)]">
            {widget.footnote}
          </p>
        ) : null}
        <div className={`flex h-52 items-end gap-4 ${isAttendance ? "pt-10" : "pt-2"}`}>
          {rows.map((row, index) => {
            const label = stringValue(cell(row, "label"), "Unknown");
            const value = numericValue(cell(row, "value"));
            const tone = liveStatusBarTone(label);
            const heightPct = Math.max((value / max) * 100, value > 0 ? 10 : 3);
            const dimmed = isAttendance && value <= 0;
            return (
              <div
                key={`${label}-${String(index)}`}
                className={`flex h-full flex-1 flex-col items-center gap-2 ${dimmed ? "opacity-40" : ""}`}
              >
                <span className="font-data text-sm text-[var(--admin-on-surface)]">
                  {value > 0 ? formatInsightNumber(value) : "-"}
                </span>
                <div className="flex w-full flex-1 items-end justify-center rounded-t bg-[var(--admin-surface-low)]">
                  <div
                    className={`w-8 rounded-t transition-opacity group-hover:opacity-80 ${statusFillClass(tone)}`}
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
      </div>
    </section>
  );
}

function DailyAttendanceChart({ widget, slug }: { widget: InsightWidget; slug: string }) {
  const points = widget.data.rows.map((row) => ({
    period: stringValue(cell(row, "period")),
    attended: numericValue(cell(row, "attended")),
    registered: numericValue(cell(row, "registered")),
  }));
  const hasData = points.some((point) => point.attended > 0 || point.registered > 0);

  return (
    <section className={`${insightPanelClassName} min-h-[320px]`} aria-label={widget.title}>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          <Link
            href={adminInsightWidgetHref(slug, widget.id)}
            prefetch={false}
            className="outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            {widget.title}
          </Link>
        </h3>
        <Link
          href={`${adminInsightWidgetHref(slug, widget.id)}?overlay=1`}
          prefetch={false}
          className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Open ${widget.title} overlay`}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {!hasData ? (
          <WidgetEmpty
            title="No trend data"
            body="Live participant joins and drops will appear as a timeline here."
            icon={<Radio className="h-7 w-7" aria-hidden="true" />}
          />
        ) : (
          <LineChartView data={widget.data} />
        )}
      </div>
      {widget.footnote ? (
        <p className="border-t border-[var(--admin-border)] px-4 py-3 text-center text-xs text-[var(--admin-on-surface-variant)]">
          {widget.footnote}
        </p>
      ) : null}
    </section>
  );
}

function UpcomingSessionsTable({
  widget,
  slug,
  emptyTitle,
  emptyBody,
}: {
  widget: InsightWidget;
  slug: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const rows = widget.data.rows;

  return (
    <section className={`${insightPanelClassName} overflow-hidden`} aria-label={widget.title}>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          <Link
            href={adminInsightWidgetHref(slug, widget.id)}
            prefetch={false}
            className="outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            {widget.title}
          </Link>
        </h3>
        <CalendarClock
          className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
      </header>
      {rows.length === 0 ? (
        <WidgetEmpty
          title={emptyTitle}
          body={emptyBody}
          icon={<CalendarClock className="h-7 w-7" aria-hidden="true" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className={insightTableHeadClassName}>
              <tr>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Scheduled</th>
                <th className="px-4 py-3 text-right">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const title = stringValue(cell(row, "title"), "Untitled session");
                const status = stringValue(cell(row, "status"), "scheduled");
                const scheduled = stringValue(cell(row, "scheduled"), "-");
                const registered = numericValue(cell(row, "registered"));
                const tone = liveStatusBarTone(status);
                const isLive = status.toLowerCase().includes("live");
                return (
                  <tr
                    key={`${title}-${String(index)}`}
                    className={`${insightTableRowClassName} relative`}
                  >
                    <td className="relative px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                      {isLive ? (
                        <span
                          className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-success)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="font-medium">{title}</span>
                      {isLive ? (
                        <div className="mt-0.5 text-[11px] font-medium text-[var(--admin-success)]">
                          Live now
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(tone)}`}
                      >
                        {liveStatusShortLabel(status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-data text-sm text-[var(--admin-on-surface)]">
                      {scheduled.includes(" ") ? scheduled.slice(11, 16) || scheduled : scheduled}
                    </td>
                    <td className="px-4 py-3 text-right font-data text-sm text-[var(--admin-on-surface)]">
                      {formatInsightNumber(registered)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SessionsDataTable({
  widget,
  slug,
  emptyTitle,
  emptyBody,
}: {
  widget: InsightWidget;
  slug: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const rows = widget.data.rows;
  const columns = widget.data.columns;

  return (
    <section className={`${insightPanelClassName} overflow-hidden`} aria-label={widget.title}>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          <Link
            href={adminInsightWidgetHref(slug, widget.id)}
            prefetch={false}
            className="outline-none hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          >
            {widget.title}
          </Link>
        </h3>
        <Link
          href={`${adminInsightWidgetHref(slug, widget.id)}?overlay=1`}
          prefetch={false}
          className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Open ${widget.title} overlay`}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      {rows.length === 0 ? (
        <WidgetEmpty
          title={emptyTitle}
          body={emptyBody}
          icon={<Inbox className="h-7 w-7" aria-hidden="true" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className={insightTableHeadClassName}>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 ${column.kind === "measure" ? "text-right" : ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(index)} className={insightTableRowClassName}>
                  {columns.map((column) => {
                    const raw = cell(row, column.key);
                    const isStatus = column.key === "status";
                    const isMeasure = column.kind === "measure";
                    if (isStatus) {
                      const status = stringValue(raw, "-");
                      const tone = liveStatusBarTone(status);
                      return (
                        <td key={column.key} className="px-4 py-3">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-wide ${statusPillClass(tone)}`}
                          >
                            {liveStatusShortLabel(status)}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-sm text-[var(--admin-on-surface)] ${
                          isMeasure ? "text-right font-data" : ""
                        }`}
                      >
                        {isMeasure ? formatInsightNumber(numericValue(raw)) : stringValue(raw, "-")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LiveDashboardChartGrid({
  widgets,
  slug,
  mode = "active",
}: {
  widgets: InsightWidget[];
  slug: string;
  mode?: "active" | "quiet" | "empty";
}) {
  const byId = useMemo(() => kpiMap(widgets), [widgets]);
  const sessionsByStatus = byId.get("sessions-by-status");
  const attendedByStatus = byId.get("attended-by-status");
  const dailyAttendance = byId.get("daily-attendance");
  const upcoming = byId.get("upcoming-sessions");
  const recent = byId.get("recent-sessions");
  const lowAttendance = byId.get("low-attendance-sessions");

  const upcomingEmptyTitle =
    mode === "empty" ? "No sessions scheduled" : "No upcoming or live sessions";
  const upcomingEmptyBody =
    mode === "empty"
      ? "There are currently no live sessions, webinars, or events for this academy. Once a session begins, real-time data will populate here."
      : "Nothing is scheduled in the near window. Recent history stays available below.";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {sessionsByStatus ? <StatusBarChart widget={sessionsByStatus} slug={slug} /> : null}
      {attendedByStatus ? <StatusBarChart widget={attendedByStatus} slug={slug} /> : null}
      {dailyAttendance ? (
        <div className="lg:col-span-2">
          <DailyAttendanceChart widget={dailyAttendance} slug={slug} />
        </div>
      ) : null}
      {upcoming ? (
        <div className="lg:col-span-2">
          <UpcomingSessionsTable
            widget={upcoming}
            slug={slug}
            emptyTitle={upcomingEmptyTitle}
            emptyBody={upcomingEmptyBody}
          />
        </div>
      ) : null}
      {recent ? (
        <SessionsDataTable
          widget={recent}
          slug={slug}
          emptyTitle="No recent sessions"
          emptyBody="Ended and completed sessions will appear here after the first live class."
        />
      ) : null}
      {lowAttendance ? (
        <SessionsDataTable
          widget={lowAttendance}
          slug={slug}
          emptyTitle="No low-attendance sessions"
          emptyBody="Sessions that finish below the attendance threshold will be listed here."
        />
      ) : null}
      {!sessionsByStatus &&
      !attendedByStatus &&
      !dailyAttendance &&
      !upcoming &&
      !recent &&
      !lowAttendance
        ? widgets
            .filter(
              (widget) =>
                LIVE_STATUS_BAR_IDS.has(widget.id) ||
                LIVE_TABLE_IDS.has(widget.id) ||
                widget.id === "daily-attendance",
            )
            .map((widget) => (
              <div key={widget.id} className="lg:col-span-2">
                <SessionsDataTable
                  widget={widget}
                  slug={slug}
                  emptyTitle="No data"
                  emptyBody="This widget has no rows yet."
                />
              </div>
            ))
        : null}
    </div>
  );
}

export function LiveDashboardQuietKpis({
  liveNow,
  upcoming,
}: {
  liveNow: number;
  upcoming: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <section className="flex flex-col rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <div className="mb-4 flex items-start justify-between">
          <span className="text-sm text-[var(--admin-on-surface-variant)]">Live now</span>
          <Radio
            className="h-5 w-5 text-[var(--admin-on-surface-variant)] opacity-50"
            aria-hidden="true"
          />
        </div>
        <div className="mt-auto">
          <p className={insightKpiValueClassName}>{formatInsightNumber(liveNow)}</p>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Nothing running right now
          </p>
        </div>
      </section>
      <section className="flex flex-col rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
        <div className="mb-4 flex items-start justify-between">
          <span className="text-sm text-[var(--admin-on-surface-variant)]">Upcoming</span>
          <CalendarClock
            className="h-5 w-5 text-[var(--admin-on-surface-variant)] opacity-50"
            aria-hidden="true"
          />
        </div>
        <div className="mt-auto">
          <p className={insightKpiValueClassName}>{formatInsightNumber(upcoming)}</p>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">Next 24 hours</p>
        </div>
      </section>
      <section className="flex flex-col rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
        <div className="mb-4 flex items-start justify-between">
          <span className="text-sm text-[var(--admin-on-surface-variant)]">Standing by</span>
          <Users className="h-5 w-5 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        </div>
        <div className="mt-auto">
          <p className="text-sm text-[var(--admin-on-surface)]">
            Historical session and attendance widgets stay available while the live window is quiet.
          </p>
        </div>
      </section>
    </div>
  );
}

export function LiveDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading live dashboard">
      <div className={`${insightShimmerClassName} h-8 w-full rounded`} />
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className={`${insightShimmerClassName} mb-2 h-8 w-64 rounded`} />
          <div className={`${insightShimmerClassName} h-4 w-48 rounded`} />
        </div>
        <div className="flex gap-2">
          <div className={`${insightShimmerClassName} h-10 w-32 rounded`} />
          <div className={`${insightShimmerClassName} h-10 w-32 rounded`} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <div className={`${insightShimmerClassName} mb-4 h-4 w-24 rounded`} />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <div className={`${insightShimmerClassName} h-4 w-20 rounded`} />
                  <div className={`${insightShimmerClassName} h-7 w-16 rounded`} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-end justify-end p-4">
          <div className={`${insightShimmerClassName} h-8 w-40 rounded`} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={`${insightPanelClassName} min-h-[320px] p-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-40 rounded`} />
          <div className="flex h-48 items-end justify-between gap-4 px-2">
            {["h-1/3", "h-2/3", "h-1/2", "h-5/6", "h-1/4"].map((height) => (
              <div
                key={height}
                className={`${insightShimmerClassName} w-full rounded-t ${height}`}
              />
            ))}
          </div>
        </div>
        <div className={`${insightPanelClassName} min-h-[320px] p-6`}>
          <div className={`${insightShimmerClassName} mb-6 h-5 w-48 rounded`} />
          <div className="flex h-48 items-end justify-between gap-4 px-2">
            {["h-5/6", "h-1/4", "h-1/6"].map((height) => (
              <div
                key={height}
                className={`${insightShimmerClassName} w-full rounded-t ${height}`}
              />
            ))}
          </div>
        </div>
        <div className={`${insightPanelClassName} col-span-1 overflow-hidden lg:col-span-2`}>
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-4">
            <div className={`${insightShimmerClassName} h-5 w-48 rounded`} />
            <div className={`${insightShimmerClassName} h-8 w-24 rounded`} />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
            >
              <div className={`${insightShimmerClassName} h-4 w-8 rounded`} />
              <div className={`${insightShimmerClassName} h-4 flex-1 rounded`} />
              <div className={`${insightShimmerClassName} h-4 flex-1 rounded`} />
              <div className={`${insightShimmerClassName} h-6 w-24 rounded-full`} />
              <div className={`${insightShimmerClassName} h-4 w-20 rounded`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
