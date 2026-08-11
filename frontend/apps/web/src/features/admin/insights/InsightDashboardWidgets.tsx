"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Inbox,
  Maximize2,
  ShoppingBag,
} from "lucide-react";
import { LineChartView } from "../../analytics/viz/charts";
import { VisualizationPanel } from "../../analytics/viz";
import { adminInsightWidgetHref } from "./admin-insights-catalog";
import type { InsightDashboardRange, InsightWidget } from "./admin-insights-api";
import {
  formatInsightMoney,
  formatInsightNumber,
  formatPeriodLabel,
  formatRelativeTime,
} from "./admin-insights-format";
import {
  insightKpiCardClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPanelClassName,
  insightPanelHeaderClassName,
  insightPanelTitleClassName,
  insightTableHeadClassName,
  insightTableRowClassName,
} from "./admin-insights-shared";

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

export function InsightSparkline({
  values,
  tone,
}: {
  values: number[];
  tone: "up" | "down" | "flat";
}) {
  if (values.length < 2) return null;
  const width = 40;
  const height = 16;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${String(x)},${String(y)}`;
    })
    .join(" ");
  const stroke =
    tone === "down"
      ? "var(--admin-danger)"
      : tone === "up"
        ? "var(--admin-success)"
        : "var(--admin-on-surface-variant)";

  return (
    <svg viewBox={`0 0 ${String(width)} ${String(height)}`} className="h-4 w-10" aria-hidden="true">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function InsightKpiCard({
  widget,
  currency,
  href,
}: {
  widget: InsightWidget;
  currency?: string | undefined;
  href?: string | undefined;
}) {
  const value = numericValue(cell(widget.data.rows[0], "value"));
  const isMoney = widget.id === "revenue";
  const deltaPct = widget.deltaPct ?? null;
  const deltaAbs = widget.deltaAbs ?? null;
  const tone: "up" | "down" | "flat" =
    (deltaPct ?? 0) > 0 || (deltaAbs ?? 0) > 0
      ? "up"
      : (deltaPct ?? 0) < 0 || (deltaAbs ?? 0) < 0
        ? "down"
        : "flat";

  const article = (
    <article className={insightKpiCardClassName} aria-label={widget.title}>
      <p className={insightKpiLabelClassName}>{widget.title}</p>
      <p className={`${insightKpiValueClassName} mt-2`}>
        {isMoney ? formatInsightMoney(value) : formatInsightNumber(value)}
      </p>
      <div className="mt-4 flex min-h-4 items-center justify-between">
        {deltaPct != null && deltaPct !== 0 ? (
          <span
            className={`inline-flex items-center gap-1 font-data text-[11px] ${
              tone === "down" ? "text-[var(--admin-danger)]" : "text-[var(--admin-success)]"
            }`}
          >
            {tone === "down" ? (
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {formatInsightNumber(Math.abs(deltaPct), Math.abs(deltaPct) % 1 === 0 ? 0 : 1)}%
            {isMoney && currency ? (
              <span className="sr-only">{` versus prior period in ${currency}`}</span>
            ) : null}
          </span>
        ) : deltaAbs != null && deltaAbs !== 0 ? (
          <span className="inline-flex items-center gap-1 font-data text-[11px] text-[var(--admin-success)]">
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            {formatInsightNumber(deltaAbs)}
          </span>
        ) : (
          <span className="font-data text-[11px] text-[var(--admin-on-surface-variant)]">
            No change
          </span>
        )}
        {widget.sparkline && widget.sparkline.length > 1 ? (
          <InsightSparkline values={widget.sparkline} tone={tone} />
        ) : null}
      </div>
    </article>
  );

  if (!href) return article;
  return (
    <Link
      href={href}
      prefetch={false}
      className="block motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-0.5"
    >
      {article}
    </Link>
  );
}

function WidgetEmpty({
  title,
  body,
  href,
  hrefLabel,
  icon,
}: {
  title: string;
  body: string;
  href?: string | null | undefined;
  hrefLabel?: string | undefined;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
        {icon}
      </div>
      <h3 className="text-base font-medium text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mt-2 max-w-[280px] text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] hover:underline"
        >
          {hrefLabel ?? "Open"}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function InsightWidgetChrome({
  widget,
  children,
  trailing,
  slug,
  range,
}: {
  widget: InsightWidget;
  children: ReactNode;
  trailing?: ReactNode | undefined;
  slug?: string | undefined;
  range?: InsightDashboardRange | undefined;
}) {
  const detailHref = slug
    ? `${adminInsightWidgetHref(slug, widget.id)}?range=${range ?? "12m"}`
    : undefined;
  return (
    <section className={`${insightPanelClassName} h-[400px]`} aria-label={widget.title}>
      <header className={insightPanelHeaderClassName}>
        <h3 className={insightPanelTitleClassName}>{widget.title}</h3>
        <div className="flex items-center gap-2">
          {trailing}
          {detailHref ? (
            <Link
              href={detailHref}
              prefetch={false}
              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
              aria-label={`Open ${widget.title}`}
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {widget.footnote ? (
        <p className="border-t border-[var(--admin-border)] px-4 py-2 text-center text-xs text-[var(--admin-on-surface-variant)]">
          {widget.footnote}
        </p>
      ) : null}
    </section>
  );
}

export function InsightLineWidget({
  widget,
  range,
  slug,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
  slug: string;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    return (
      <InsightWidgetChrome widget={widget} slug={slug} range={range}>
        <WidgetEmpty
          title="No revenue in this period"
          body="Paid orders will appear here once checkout activity starts."
          href="/admin/reports/payments"
          hrefLabel="View payments report"
          icon={<CreditCard className="h-8 w-8" aria-hidden="true" />}
        />
      </InsightWidgetChrome>
    );
  }

  const values = rows.map((row) => numericValue(cell(row, "value")));
  const max = Math.max(...values, 1);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const avgTop = `${String(100 - (avg / max) * 100)}%`;

  return (
    <InsightWidgetChrome
      widget={widget}
      slug={slug}
      range={range}
      trailing={
        <span className="hidden text-xs text-[var(--admin-on-surface-variant)] sm:inline">
          Line chart
        </span>
      }
    >
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4">
        <div className="mb-2 flex justify-between font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          <span>{formatInsightNumber(max)}</span>
          <span>Avg {formatInsightNumber(avg, avg >= 100 ? 0 : 1)}</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--admin-outline)]"
            style={{ top: avgTop }}
            aria-hidden="true"
          />
          <LineChartView data={widget.data} />
        </div>
        <div className="mt-1 flex justify-between font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          <span>{formatPeriodLabel(stringValue(cell(rows[0], "period")), range)}</span>
          <span>
            {formatPeriodLabel(stringValue(cell(rows[rows.length - 1], "period")), range)}
          </span>
        </div>
      </div>
    </InsightWidgetChrome>
  );
}

export function InsightGroupedBarWidget({
  widget,
  range,
  slug,
}: {
  widget: InsightWidget;
  range: InsightDashboardRange;
  slug: string;
}) {
  const rows = widget.data.rows;
  const measureKeys = widget.data.measures ?? ["paid", "free"];
  if (rows.length === 0) {
    return (
      <InsightWidgetChrome widget={widget} slug={slug} range={range}>
        <WidgetEmpty
          title="No enrollments in this period"
          body="New enrollments will plot here as learners join courses."
          href="/admin/reports/resource-usage"
          hrefLabel="View resource usage"
          icon={<GraduationCap className="h-8 w-8" aria-hidden="true" />}
        />
      </InsightWidgetChrome>
    );
  }

  const max = Math.max(
    ...rows.flatMap((row) => measureKeys.map((key) => numericValue(row[key]))),
    1,
  );

  return (
    <InsightWidgetChrome
      widget={widget}
      slug={slug}
      range={range}
      trailing={
        <div className="flex items-center gap-3 text-xs text-[var(--admin-on-surface-variant)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" /> Paid
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_55%,var(--admin-surface))]" />{" "}
            Free
          </span>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-6">
        <div className="flex min-h-0 flex-1 items-end gap-2">
          {rows.map((row, index) => (
            <div
              key={stringValue(cell(row, "period"), String(index))}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
            >
              <div className="flex min-h-0 flex-1 items-end justify-center gap-0.5">
                {measureKeys.map((key, measureIndex) => {
                  const value = numericValue(row[key]);
                  const height = `${String(Math.max((value / max) * 100, value > 0 ? 4 : 0))}%`;
                  return (
                    <div
                      key={key}
                      title={`${key}: ${formatInsightNumber(value)}`}
                      className="w-1/2 rounded-t"
                      style={{
                        height,
                        backgroundColor:
                          measureIndex === 0
                            ? "var(--admin-primary)"
                            : "color-mix(in srgb, var(--admin-primary) 55%, var(--admin-surface))",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 font-data text-[11px] text-[var(--admin-on-surface-variant)]">
          {rows.map((row, index) => (
            <span
              key={`label-${stringValue(cell(row, "period"), String(index))}`}
              className="min-w-0 flex-1 truncate text-center"
            >
              {formatPeriodLabel(stringValue(cell(row, "period")), range)}
            </span>
          ))}
        </div>
      </div>
    </InsightWidgetChrome>
  );
}

export function InsightTopProductsWidget({
  widget,
  slug,
  range,
}: {
  widget: InsightWidget;
  slug: string;
  range: InsightDashboardRange;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    return (
      <InsightWidgetChrome widget={widget} slug={slug} range={range}>
        <WidgetEmpty
          title="No products yet"
          body="Publish a course or bundle to see learner and revenue share here."
          href="/admin/courses"
          hrefLabel="Go to course catalog"
          icon={<BookOpen className="h-8 w-8" aria-hidden="true" />}
        />
      </InsightWidgetChrome>
    );
  }

  const maxRevenue = Math.max(...rows.map((row) => numericValue(cell(row, "revenue"))), 1);

  return (
    <InsightWidgetChrome widget={widget} slug={slug} range={range}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className={`${insightTableHeadClassName} px-4 py-2`}>Product</th>
              <th className={`${insightTableHeadClassName} px-4 py-2 text-right`}>Learners</th>
              <th className={`${insightTableHeadClassName} px-4 py-2 text-right`}>Revenue</th>
              <th className={`${insightTableHeadClassName} w-24 px-4 py-2`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const revenue = numericValue(cell(row, "revenue"));
              const share = Math.round((revenue / maxRevenue) * 100);
              const isLead = index === 0;
              return (
                <tr
                  key={stringValue(cell(row, "title"), String(index))}
                  className={`${insightTableRowClassName} ${
                    isLead ? "bg-[var(--admin-primary-container)]" : ""
                  }`}
                >
                  <td
                    className={`px-4 ${isLead ? "border-l-2 border-[var(--admin-primary)]" : ""}`}
                  >
                    <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                      {stringValue(cell(row, "title"), "Untitled")}
                    </div>
                    <div className="text-xs text-[var(--admin-on-surface-variant)]">
                      {stringValue(cell(row, "kind"), "Course")}
                    </div>
                  </td>
                  <td className="px-4 text-right font-data text-sm">
                    {formatInsightNumber(numericValue(cell(row, "students")))}
                  </td>
                  <td className="px-4 text-right font-data text-sm">
                    {formatInsightMoney(revenue)}
                  </td>
                  <td className="px-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-outline)]">
                      <div
                        className="h-full bg-[var(--admin-primary)]"
                        style={{ width: `${String(share)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </InsightWidgetChrome>
  );
}

export function InsightOrdersStatusWidget({
  widget,
  slug,
  range,
}: {
  widget: InsightWidget;
  slug: string;
  range: InsightDashboardRange;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    return (
      <InsightWidgetChrome widget={widget} slug={slug} range={range}>
        <WidgetEmpty
          title="No orders yet"
          body="Order statuses will stack here after the first checkout attempt."
          href="/admin/reports/payments"
          hrefLabel="View payments report"
          icon={<ShoppingBag className="h-8 w-8" aria-hidden="true" />}
        />
      </InsightWidgetChrome>
    );
  }

  const max = Math.max(...rows.map((row) => numericValue(cell(row, "value"))), 1);

  return (
    <InsightWidgetChrome
      widget={widget}
      slug={slug}
      range={range}
      trailing={
        <span className="hidden text-xs text-[var(--admin-on-surface-variant)] sm:inline">
          Horizontal
        </span>
      }
    >
      <div className="flex flex-1 flex-col justify-center gap-4 px-5 py-5">
        {rows.map((row) => {
          const label = stringValue(cell(row, "label"), "Unknown");
          const value = numericValue(cell(row, "value"));
          const isFailed = label.toLowerCase() === "failed";
          const isPaid = label.toLowerCase() === "paid";
          const width = `${String(Math.max((value / max) * 80, value > 0 ? 6 : 0))}%`;
          return (
            <div key={label} className="flex items-center gap-4">
              <div
                className={`w-24 text-right text-xs ${
                  isFailed
                    ? "font-medium text-[var(--admin-danger)]"
                    : "text-[var(--admin-on-surface)]"
                }`}
              >
                {label}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={`h-6 rounded-r ${
                    isFailed
                      ? "bg-[var(--admin-danger)]"
                      : isPaid
                        ? "bg-[var(--admin-primary)]"
                        : "bg-[var(--admin-outline)]"
                  }`}
                  style={{ width }}
                />
                <span
                  className={`font-data text-sm ${
                    isFailed ? "text-[var(--admin-danger)]" : "text-[var(--admin-on-surface)]"
                  }`}
                >
                  {formatInsightNumber(value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </InsightWidgetChrome>
  );
}

export function InsightFailedPaymentsWidget({
  widget,
  slug,
  range,
}: {
  widget: InsightWidget;
  slug: string;
  range: InsightDashboardRange;
}) {
  const rows = widget.data.rows;
  if (rows.length === 0) {
    return (
      <InsightWidgetChrome widget={widget} slug={slug} range={range}>
        <WidgetEmpty
          title="No failed payments in this period"
          body="All billing attempts completed. Review historical data in the finance report."
          href={widget.href ?? "/admin/reports/payments"}
          hrefLabel="View financial report"
          icon={<CreditCard className="h-8 w-8" aria-hidden="true" />}
        />
      </InsightWidgetChrome>
    );
  }

  return (
    <InsightWidgetChrome widget={widget} slug={slug} range={range}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <thead>
            <tr>
              <th className={`${insightTableHeadClassName} px-4 py-2`}>Learner</th>
              <th className={`${insightTableHeadClassName} px-4 py-2`}>Product</th>
              <th className={`${insightTableHeadClassName} px-4 py-2 text-right`}>Amount</th>
              <th className={`${insightTableHeadClassName} px-4 py-2`}>Gateway</th>
              <th className={`${insightTableHeadClassName} px-4 py-2`}>Failure reason</th>
              <th className={`${insightTableHeadClassName} px-4 py-2`}>Attempted</th>
              <th className={`${insightTableHeadClassName} px-4 py-2`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const href = stringValue(cell(row, "href"));
              return (
                <tr
                  key={`${stringValue(cell(row, "learner"), "row")}-${String(index)}`}
                  className={`${insightTableRowClassName} bg-[color-mix(in_srgb,var(--admin-danger)_5%,var(--admin-surface))]`}
                >
                  <td className="border-l-2 border-[var(--admin-danger)] px-4 text-sm text-[var(--admin-on-surface)]">
                    {stringValue(cell(row, "learner"), "Unknown learner")}
                  </td>
                  <td className="px-4 text-sm text-[var(--admin-on-surface-variant)]">
                    {stringValue(cell(row, "product"), "Unknown product")}
                  </td>
                  <td className="px-4 text-right font-data text-sm">
                    {formatInsightMoney(numericValue(cell(row, "amount")))}
                  </td>
                  <td className="px-4 text-sm text-[var(--admin-on-surface-variant)]">
                    {stringValue(cell(row, "gateway"), "Unknown")}
                  </td>
                  <td className="px-4 text-sm text-[var(--admin-danger)]">
                    {stringValue(cell(row, "reason"), "Payment declined")}
                  </td>
                  <td className="px-4 font-data text-sm text-[var(--admin-on-surface-variant)]">
                    {formatRelativeTime(stringValue(cell(row, "attempted")))}
                  </td>
                  <td className="px-4 text-right">
                    {href ? (
                      <Link
                        href={href}
                        prefetch={false}
                        className="text-sm text-[var(--admin-primary)] hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </InsightWidgetChrome>
  );
}

export function InsightGenericWidget({ widget, slug }: { widget: InsightWidget; slug: string }) {
  const empty = widget.data.rows.length === 0;

  const emptyCopy = useMemo(() => {
    if (widget.id === "upcoming-live") {
      return {
        title: "No upcoming live classes scheduled",
        body: "There are no synchronous sessions in this window. Schedule new sessions in the catalog.",
        href: "/admin/live-sessions",
        hrefLabel: "Go to live sessions",
        icon: <Calendar className="h-8 w-8" aria-hidden="true" />,
      };
    }
    return {
      title: `No ${widget.title.toLowerCase()} yet`,
      body: "This widget fills in as academy activity is recorded.",
      href: widget.href ?? null,
      hrefLabel: "Open related report",
      icon: <Inbox className="h-8 w-8" aria-hidden="true" />,
    };
  }, [widget.href, widget.id, widget.title]);

  if (empty) {
    return (
      <InsightWidgetChrome widget={widget} slug={slug}>
        <WidgetEmpty
          title={emptyCopy.title}
          body={emptyCopy.body}
          href={emptyCopy.href}
          hrefLabel={emptyCopy.hrefLabel}
          icon={emptyCopy.icon}
        />
      </InsightWidgetChrome>
    );
  }

  return (
    <div className="min-h-[280px]">
      <VisualizationPanel
        preferenceKey={`insight:${slug}:${widget.id}`}
        title={widget.title}
        data={widget.data}
        defaultViz={widget.defaultViz}
      />
    </div>
  );
}

export function widgetSpanClassName(span: InsightWidget["span"]): string {
  switch (span) {
    case "full":
      return "col-span-12";
    case "third":
      return "col-span-12 md:col-span-6 xl:col-span-4";
    case "half":
    default:
      return "col-span-12 md:col-span-6";
  }
}

export function renderSpecializedWidget(
  widget: InsightWidget,
  range: InsightDashboardRange,
  slug: string,
): ReactNode {
  if (widget.id === "monthly-revenue") {
    return <InsightLineWidget widget={widget} range={range} slug={slug} />;
  }
  if (widget.id === "monthly-enrollments") {
    return <InsightGroupedBarWidget widget={widget} range={range} slug={slug} />;
  }
  if (widget.id === "top-products") {
    return <InsightTopProductsWidget widget={widget} slug={slug} range={range} />;
  }
  if (widget.id === "payment-orders") {
    return <InsightOrdersStatusWidget widget={widget} slug={slug} range={range} />;
  }
  if (widget.id === "failed-payments") {
    return <InsightFailedPaymentsWidget widget={widget} slug={slug} range={range} />;
  }
  return <InsightGenericWidget widget={widget} slug={slug} />;
}
