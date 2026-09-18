"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Info,
  RotateCcw,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import { AttributionEmptyState, AttributionErrorState } from "./AttributionStates";
import { fetchAttributionHealth, type AttributionHealth } from "./attribution-api";
import {
  attributedPercent,
  attributionNoteClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  attributionTableHeadCellClassName,
  attributionTableShellClassName,
  barHeightPercent,
  dailyAttributionRate,
  formatRelative,
  formatShare,
  formatUtcDay,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution/health`.
 *
 * Every other attribution surface reports a single aggregate, and a total
 * cannot show the two failures that actually matter: a beacon that stopped days
 * ago, and an attribution rate that collapsed on a particular day. A log with
 * 60,000 events looks identical whether the newest arrived this morning or last
 * month. This screen is the daily shape.
 *
 * Days are UTC and the page says so. Bucketing a marketing series in the
 * reader's local zone would put the same event in different days for two
 * colleagues comparing notes.
 */

const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";
const MARKETING_INSIGHT_HREF = "/admin/insights/marketing-insight";
const SETTINGS_HREF = "/admin/reports/sales-marketing/attribution/settings";

const WINDOW_OPTIONS = [7, 14, 30, 60, 90, 180];

/**
 * A rate drop worth naming.
 *
 * Compares the last quarter of the window against the rest. Smaller swings are
 * ordinary traffic-mix noise, and a screen that flagged them would be ignored.
 */
const RATE_DROP_POINTS = 20;

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const alertClassName =
  "flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3";

/** Attribution rate over the recent tail versus the rest of the window. */
function rateSplit(series: AttributionHealth["series"]): {
  recent: number | null;
  earlier: number | null;
} {
  const cut = Math.max(1, Math.floor(series.length / 4));
  const recentDays = series.slice(-cut);
  const earlierDays = series.slice(0, -cut);
  const rate = (days: AttributionHealth["series"]): number | null => {
    const total = days.reduce((sum, day) => sum + day.total, 0);
    if (total === 0) return null;
    return (days.reduce((sum, day) => sum + day.attributed, 0) / total) * 100;
  };
  return { recent: rate(recentDays), earlier: rate(earlierDays) };
}

export function AdminAttributionHealthPage() {
  const [days, setDays] = useState(30);
  const [windowOpen, setWindowOpen] = useState(false);
  const [data, setData] = useState<AttributionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(async (window: number, mode: "initial" | "refresh") => {
    const ticket = ++requestId.current;
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetchAttributionHealth(window);
      // A series for a window the operator has already changed would put the
      // wrong number of days under the right heading.
      if (ticket !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setData(null);
      setError(caught instanceof ClientApiError ? caught.message : "Health could not be read.");
    } finally {
      if (ticket === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(days, "initial");
  }, [load, days]);

  return (
    <div className="space-y-5">
      <SalesMarketingReportTabs active="attribution" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link
            href={ATTRIBUTION_HREF}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Attribution events
          </Link>
          <h1 className={managePageTitleClassName}>Tracking health</h1>
          <p className={managePageDescClassName}>
            Whether events are still arriving, and whether they still carry attribution.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <DropdownField
              label={
                <span
                  className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  id="health-window-label"
                >
                  Window
                </span>
              }
              labelId="health-window"
              open={windowOpen}
              panelAriaLabel="Health window"
              onToggle={() => {
                setWindowOpen((previous) => !previous);
              }}
              triggerContent={`${String(days)} days`}
            >
              <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                {WINDOW_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={option === days}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setDays(option);
                      setWindowOpen(false);
                    }}
                  >
                    {option} days
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={loading || refreshing}
            onClick={() => {
              void load(days, "refresh");
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          {/* Health counts the faults; anomalies lists the events. */}
          <Link
            href="/admin/reports/sales-marketing/attribution/anomalies"
            className={manageSecondaryButtonClassName}
          >
            Anomalies
          </Link>
          <Link href={SETTINGS_HREF} className={manageSecondaryButtonClassName}>
            Settings
          </Link>
        </div>
      </div>

      {error !== null ? (
        <AttributionErrorState
          message={error}
          retrying={refreshing}
          onRetry={() => {
            void load(days, "refresh");
          }}
        />
      ) : loading ? (
        <HealthSkeleton />
      ) : data === null ? null : data.lastEventAt === null ? (
        <AttributionEmptyState insightHref={MARKETING_INSIGHT_HREF} />
      ) : (
        <HealthBody data={data} />
      )}
    </div>
  );
}

function HealthBody({ data }: { data: AttributionHealth }) {
  const { recent, earlier } = rateSplit(data.series);
  const rateDropped = recent !== null && earlier !== null && earlier - recent >= RATE_DROP_POINTS;
  const windowRate = attributedPercent(data.windowAttributed, data.windowTotal);
  const healthy = data.trailingSilentDays === 0 && !rateDropped && data.windowSkewed === 0;

  return (
    <>
      <div className={attributionNoteClassName}>
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {/* Said out loud because two colleagues comparing notes in different
              zones would otherwise disagree about which day an event fell in. */}
          Days are UTC, bucketed on when each event reportedly happened. Covering{" "}
          {formatUtcDay(data.since)} to today.
        </p>
      </div>

      {data.trailingSilentDays > 0 ? (
        <div role="alert" className={alertClassName}>
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
              Nothing has arrived for {data.trailingSilentDays}{" "}
              {data.trailingSilentDays === 1 ? "day" : "days"}
            </h2>
            {/* The failure a headline count cannot show: plenty of events, none
                of them recent. */}
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              The log holds {data.windowTotal.toLocaleString()} events over this window, but the
              most recent is {formatRelative(data.lastEventAt ?? "")}. If the site has had traffic
              since, the tracking snippets are the first thing to check.
            </p>
          </div>
        </div>
      ) : null}

      {rateDropped ? (
        <div role="alert" className={alertClassName}>
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
              Attribution rate has fallen
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {formatShare(earlier)} of events carried attribution earlier in this window, against{" "}
              {formatShare(recent)} recently. A drop that size usually means campaign links stopped
              carrying their query string, rather than a change in who is visiting.
            </p>
          </div>
        </div>
      ) : null}

      {healthy ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))] px-4 py-3"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {/* Scoped to what was actually checked, rather than a blanket
                "all good" the page cannot support. */}
            Events arrived today, the attribution rate is steady across the window, and no event was
            recorded at a time that disagrees with when it happened.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>Events in window</span>
          <span className={attributionSignalValueClassName}>
            {data.windowTotal.toLocaleString()}
          </span>
        </div>
        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>Carrying attribution</span>
          <span className={attributionSignalValueClassName}>
            {windowRate === null ? "—" : `${String(windowRate)}%`}
          </span>
        </div>
        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>Last event</span>
          <span className={`${attributionSignalValueClassName} text-base`}>
            {data.lastEventAt === null ? "—" : formatRelative(data.lastEventAt)}
          </span>
        </div>
        <div className={attributionSignalCardClassName}>
          <span className={attributionSignalLabelClassName}>Clock disagreements</span>
          <span
            className={`${attributionSignalValueClassName} ${
              data.windowSkewed > 0 ? "text-[var(--admin-warning)]" : ""
            }`}
          >
            {data.windowSkewed.toLocaleString()}
          </span>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            recorded over {Math.round(data.skewToleranceSeconds / 60)} min from when they happened
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${panelClassName} lg:col-span-2`}>
          <div className={panelHeaderClassName}>
            <h2 className={panelTitleClassName}>Events per day</h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Bar height is relative to the busiest day. The lighter portion carried no attribution.
            </p>
          </div>
          <DailyChart series={data.series} />
        </section>

        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <h2 className={panelTitleClassName}>Event types</h2>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              {/* Signups still arriving while purchases stopped is invisible in
                  any total, and obvious here. */}
              A stage that stopped reporting shows up as a stale last-seen.
            </p>
          </div>
          {data.eventTypes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
              No events of any type in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <tr>
                    <th className={attributionTableHeadCellClassName}>Type</th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Events</th>
                    <th className={`${attributionTableHeadCellClassName} text-right`}>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eventTypes.map((entry) => {
                    const stale = Date.now() - Date.parse(entry.lastSeenAt) > 3 * 86_400_000;
                    return (
                      <tr
                        key={entry.eventType}
                        className="border-b border-[var(--admin-border)] last:border-b-0"
                      >
                        <td className="font-data px-4 py-2.5 text-sm text-[var(--admin-on-surface)]">
                          {entry.eventType}
                        </td>
                        <td className="font-data px-4 py-2.5 text-right text-sm tabular-nums text-[var(--admin-on-surface)]">
                          {entry.total.toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right text-sm ${
                            stale
                              ? "text-[var(--admin-warning)]"
                              : "text-[var(--admin-on-surface-variant)]"
                          }`}
                        >
                          {formatRelative(entry.lastSeenAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-[var(--admin-border)] p-4">
            <Link
              href={ATTRIBUTION_HREF}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
            >
              Open the event log
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function DailyChart({ series }: { series: AttributionHealth["series"] }) {
  const peak = series.reduce((max, day) => Math.max(max, day.total), 0);

  return (
    <div className="p-5">
      <div className="flex h-48 items-end gap-1">
        {series.map((day) => {
          const rate = dailyAttributionRate(day);
          const height = barHeightPercent(day.total, peak);
          const attributedShare = day.total === 0 ? 0 : (day.attributed / day.total) * 100;
          return (
            <div
              key={day.day}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${formatUtcDay(day.day)} · ${day.total.toLocaleString()} events${
                rate === null ? "" : ` · ${formatShare(rate)} attributed`
              }`}
            >
              {day.total === 0 ? (
                // A silent day is a visible baseline, not an absence. A chart
                // that skipped it would draw a continuous line through an
                // outage.
                <span
                  className="block h-[2px] w-full rounded-sm bg-[var(--admin-outline)]"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="relative block w-full overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-surface-high))]"
                  style={{ height: `${String(height)}%` }}
                  aria-hidden="true"
                >
                  <span
                    className="absolute inset-x-0 bottom-0 block bg-[var(--admin-primary)]"
                    style={{ height: `${String(attributedShare)}%` }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-[var(--admin-on-surface-variant)]">
        <span>{formatUtcDay(series[0]?.day ?? "")}</span>
        <span>{formatUtcDay(series.at(-1)?.day ?? "")}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--admin-on-surface-variant)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--admin-primary)]" aria-hidden="true" />
          Carried attribution
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-surface-high))]"
            aria-hidden="true"
          />
          No UTM
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-2.5 bg-[var(--admin-outline)]" aria-hidden="true" />
          No events
        </span>
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={attributionSignalCardClassName}>
            <div className="h-3 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className={`${attributionTableShellClassName} lg:col-span-2`}>
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="h-4 w-32 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          </div>
          <div className="flex h-48 items-end gap-1 p-5">
            {Array.from({ length: 30 }, (_, index) => (
              <div
                key={index}
                className="flex-1 rounded-sm bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                style={{ height: `${String(20 + ((index * 17) % 70))}%` }}
              />
            ))}
          </div>
        </div>
        <div className={attributionTableShellClassName}>
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="h-4 w-28 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
