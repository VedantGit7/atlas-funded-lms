"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Info,
  Lightbulb,
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
import { AttributionErrorState } from "./AttributionStates";
import {
  fetchAttributionGaps,
  type AttributionGapEvent,
  type AttributionGapKind,
  type AttributionGaps,
} from "./attribution-api";
import {
  GAP_COPY,
  attributionNoteClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  attributionTableHeadCellClassName,
  attributionTableShellClassName,
  formatRevenue,
  formatShare,
  formatTimestamp,
  gapShare,
} from "./attribution-shared";
import { csvRow } from "../../../lib/export/csv";

/**
 * `/admin/reports/sales-marketing/attribution/unattributed`.
 *
 * Events that cannot be credited to a campaign, scanned across the window
 * rather than over whatever the log happened to load — a share of "the loaded
 * events" is a number about the screen, not about the academy.
 *
 * The two kinds are kept apart because they almost never share a fix. Nothing
 * at all usually means a link never carried parameters; a partial set usually
 * means one field is missing from a template. And partial attribution is
 * detected nowhere else here: an event with a source but no campaign passes the
 * "any UTM field" test everywhere and is counted as attributed, while still
 * landing in a breakdown row that reads "(not set)".
 */

const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";
const ANOMALIES_HREF = "/admin/reports/sales-marketing/attribution/anomalies";
const SOURCES_HREF = "/admin/reports/sales-marketing/attribution/sources";

const WINDOW_OPTIONS = [7, 14, 30, 60, 90, 180];

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const countChipClassName =
  "font-data inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--admin-warning)]";

const missingPillClassName =
  "font-data inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-warning)]";

/** CSV of both groups, with the missing fields named per row. */
function gapsToCsv(groups: AttributionGaps["groups"]): string {
  return [
    csvRow([
      "Gap",
      "Occurred at",
      "Event type",
      "UTM source",
      "UTM medium",
      "UTM campaign",
      "Missing",
      "Revenue",
      "Currency",
      "Membership ID",
      "Event ID",
    ]),
    ...groups.flatMap((group) =>
      group.items.map((event) =>
        csvRow([
          GAP_COPY[group.kind].title,
          event.occurredAt,
          event.eventType,
          event.utmSource ?? "",
          event.utmMedium ?? "",
          event.utmCampaign ?? "",
          event.missing.join(" "),
          // Blank rather than zero: no revenue is not zero revenue.
          event.revenueCents === null ? "" : (event.revenueCents / 100).toFixed(2),
          event.currency ?? "",
          event.membershipId ?? "",
          event.id,
        ]),
      ),
    ),
  ].join("\r\n");
}

export function AdminAttributionUnattributedPage() {
  const [days, setDays] = useState(30);
  const [windowOpen, setWindowOpen] = useState(false);
  const [data, setData] = useState<AttributionGaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(async (window: number, mode: "initial" | "refresh") => {
    const ticket = ++requestId.current;
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetchAttributionGaps(window);
      if (ticket !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setData(null);
      setError(caught instanceof ClientApiError ? caught.message : "The scan could not be run.");
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

  function exportGaps() {
    if (data === null) return;
    const csv = gapsToCsv(data.groups);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unattributed-events-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    const rows = data.groups.reduce((sum, group) => sum + group.items.length, 0);
    const anyTruncated = data.groups.some((group) => group.truncated);
    setNotice(
      anyTruncated
        ? `Exported ${String(rows)} rows — the ${String(data.sampleLimit)} most recent of each group. The counts above cover the whole window.`
        : `Exported ${String(rows)} ${rows === 1 ? "event" : "events"}.`,
    );
  }

  const populated = data?.groups.filter((group) => group.total > 0) ?? [];
  const share = data === null ? null : gapShare(data.affectedTotal, data.scannedTotal);

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
          <h1 className={managePageTitleClassName}>Unattributed and incomplete</h1>
          <p className={managePageDescClassName}>
            Events that cannot be credited to a campaign, and why.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <DropdownField
              label={
                <span
                  className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  id="gap-window-label"
                >
                  Window
                </span>
              }
              labelId="gap-window"
              open={windowOpen}
              panelAriaLabel="Scan window"
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
            Rescan
          </button>
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={populated.length === 0}
            onClick={exportGaps}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      <div className={attributionNoteClassName}>
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        {/* The honest version of the note. Every count below is a scan of the
            window, not of whatever the log happened to load. */}
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Scanned across every event in the window, not the rows the log has loaded. Attribution
          events cannot be edited or backfilled from this console — these are read and fixed at the
          source of the links.
        </p>
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
        <GapsSkeleton />
      ) : data === null ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Cannot be credited</span>
              <span
                className={`${attributionSignalValueClassName} ${
                  data.affectedTotal > 0 ? "text-[var(--admin-warning)]" : ""
                }`}
              >
                {data.affectedTotal.toLocaleString()}
              </span>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                of {data.scannedTotal.toLocaleString()} scanned
              </p>
            </div>
            {data.groups.map((group) => (
              <div key={group.kind} className={attributionSignalCardClassName}>
                <span className={attributionSignalLabelClassName}>
                  {GAP_COPY[group.kind].title}
                </span>
                <span
                  className={`${attributionSignalValueClassName} ${
                    group.total > 0 ? "text-[var(--admin-warning)]" : ""
                  }`}
                >
                  {group.total.toLocaleString()}
                </span>
              </div>
            ))}
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Share of scanned</span>
              <span className={attributionSignalValueClassName}>
                {/* An empty window is not 0%; it has no share. */}
                {formatShare(share)}
              </span>
              <span
                className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-[var(--admin-warning)]"
                  style={{ width: `${String(share ?? 0)}%` }}
                />
              </span>
            </div>
          </div>

          {data.missingSource + data.missingMedium + data.missingCampaign > 0 ? (
            <section className={panelClassName}>
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5">
                <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
                  Which field is missing
                </h2>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  {/* The most actionable figure here: one field of one template,
                      rather than "something is wrong". */}
                  Across the partially attributed events. One event can be missing more than one, so
                  these do not sum to the group total.
                </p>
              </div>
              <dl className="divide-y divide-[var(--admin-border)]">
                {[
                  { label: "utm_source", value: data.missingSource },
                  { label: "utm_medium", value: data.missingMedium },
                  { label: "utm_campaign", value: data.missingCampaign },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <dt className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                      {field.label}
                    </dt>
                    <dd
                      className={`font-data text-sm tabular-nums ${
                        field.value > 0
                          ? "text-[var(--admin-warning)]"
                          : "text-[var(--admin-on-surface)]"
                      }`}
                    >
                      {field.value.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {populated.length === 0 ? (
                <div className="admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center motion-safe:animate-[admin-fade-in_0.2s_ease-out]">
                  <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Every event can be credited
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                    {/* Scoped to what was scanned, and to what this screen
                        actually checks. */}
                    All {data.scannedTotal.toLocaleString()} events in the last {data.days} days
                    carry a full source, medium and campaign.
                  </p>
                </div>
              ) : (
                populated.map((group) => (
                  <GapGroup
                    key={group.kind}
                    kind={group.kind}
                    total={group.total}
                    truncated={group.truncated}
                    items={group.items}
                    sampleLimit={data.sampleLimit}
                  />
                ))
              )}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
              {populated.map((group) => (
                <section key={group.kind} className={panelClassName}>
                  <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface)]">
                      <Lightbulb
                        className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      Common causes
                    </h2>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {GAP_COPY[group.kind].title}
                    </p>
                  </div>
                  <ul className="space-y-3 px-5 py-4">
                    {GAP_COPY[group.kind].causes.map((cause) => (
                      <li
                        key={cause}
                        className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]"
                      >
                        {cause}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {data.revenueWithoutCurrency > 0 ? (
                <section className={panelClassName}>
                  <div className="flex items-start gap-3 px-5 py-4">
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      {/* Counted here, listed on anomalies. Two lists of the
                          same rows would be two things to keep in step. */}
                      <span className="font-semibold text-[var(--admin-on-surface)]">
                        {data.revenueWithoutCurrency.toLocaleString()}
                      </span>{" "}
                      {data.revenueWithoutCurrency === 1 ? "event carries" : "events carry"} revenue
                      with no currency, so those amounts join no total.{" "}
                      <Link
                        href={ANOMALIES_HREF}
                        className="font-semibold text-[var(--admin-primary)] hover:underline"
                      >
                        Listed under anomalies
                      </Link>
                      .
                    </p>
                  </div>
                </section>
              ) : null}

              <Link
                href={SOURCES_HREF}
                className={`${manageSecondaryButtonClassName} w-full justify-center`}
              >
                See the breakdown
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </>
      )}

      {notice !== null ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          <span className="text-sm text-[var(--admin-on-surface)]">{notice}</span>
          <button
            type="button"
            className="ml-auto text-sm font-semibold text-[var(--admin-primary)]"
            onClick={() => {
              setNotice(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GapGroup({
  kind,
  total,
  truncated,
  items,
  sampleLimit,
}: {
  kind: AttributionGapKind;
  total: number;
  truncated: boolean;
  items: AttributionGapEvent[];
  sampleLimit: number;
}) {
  const copy = GAP_COPY[kind];

  return (
    <section className={panelClassName}>
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">{copy.title}</h2>
          <span className={countChipClassName}>{total.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">{copy.why}</p>
        {truncated ? (
          <p className="mt-2 text-sm font-semibold text-[var(--admin-warning)]">
            Showing the {sampleLimit} most recent of {total.toLocaleString()}.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <tr>
              <th className={attributionTableHeadCellClassName}>Occurred</th>
              <th className={attributionTableHeadCellClassName}>Event</th>
              <th className={attributionTableHeadCellClassName}>
                {kind === "no-utm" ? "Attribution" : "Source / medium / campaign"}
              </th>
              <th className={`${attributionTableHeadCellClassName} text-right`}>Revenue</th>
              <th className={attributionTableHeadCellClassName}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((event) => (
              <tr
                key={event.id}
                className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_5%,transparent)] motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)]"
              >
                <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)]">
                  {formatTimestamp(event.occurredAt)}
                </td>
                <td className="font-data whitespace-nowrap px-4 py-2.5 text-sm text-[var(--admin-on-surface)]">
                  {event.eventType}
                </td>
                <td className="px-4 py-2.5 text-sm">
                  {kind === "no-utm" ? (
                    <span className="text-[var(--admin-warning)]">Nothing captured</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* The values that did arrive, then the fields that did
                          not — named, rather than three "(not set)" cells the
                          reader has to diff. */}
                      <span className="font-data text-[var(--admin-on-surface)]">
                        {[event.utmSource, event.utmMedium, event.utmCampaign]
                          .map((value) => value ?? "—")
                          .join(" / ")}
                      </span>
                      {event.missing.map((field) => (
                        <span key={field} className={missingPillClassName}>
                          no {field}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="font-data whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-[var(--admin-on-surface)]">
                  {formatRevenue(event.revenueCents, event.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {/* A real destination rather than an overflow menu with
                      nothing behind it. */}
                  <Link
                    href={`${ATTRIBUTION_HREF}/${event.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                  >
                    Open
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GapsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={attributionSignalCardClassName}>
            <div className="h-3 w-28 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {Array.from({ length: 2 }, (_, panel) => (
            <div key={panel} className={attributionTableShellClassName}>
              <div className="space-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
                <div className="h-4 w-44 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
              </div>
              {Array.from({ length: 4 }, (_, row) => (
                <div
                  key={row}
                  className="flex items-center gap-4 border-b border-[var(--admin-border)] px-4 py-3"
                >
                  <div className="h-3.5 w-32 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                  <div className="h-3.5 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                  <div className="ml-auto h-3.5 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={attributionTableShellClassName}>
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="h-4 w-32 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }, (_, row) => (
              <div
                key={row}
                className="h-3 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                style={{ width: `${String(70 + ((row * 11) % 25))}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
