"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
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
import { AttributionErrorState } from "./AttributionStates";
import {
  fetchAttributionAnomalies,
  type AttributionAnomalies,
  type AttributionAnomalyEvent,
  type AttributionAnomalyKind,
} from "./attribution-api";
import {
  ANOMALY_COPY,
  attributionNoteClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  attributionTableHeadCellClassName,
  attributionTableShellClassName,
  formatTimestamp,
  utmFields,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution/anomalies`.
 *
 * The faults, as rows an operator can open. The health screen counts two of
 * these kinds and the breakdown counts a third; a count says something is
 * wrong, and only a list says which events to look at. Three kinds — a
 * double-firing tag, a template published with its placeholder intact, and an
 * event dated in the future — are detected nowhere else in this console.
 *
 * Every kind here makes a number wrong somewhere downstream. Merely unusual
 * rows are left out on purpose: a screen that flags ordinary variation gets
 * ignored, and then so does the one real finding on it.
 */

const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";
const HEALTH_HREF = "/admin/reports/sales-marketing/attribution/health";

const WINDOW_OPTIONS = [7, 14, 30, 60, 90, 180];

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const countChipClassName =
  "font-data inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--admin-warning)]";

export function AdminAttributionAnomaliesPage() {
  const [days, setDays] = useState(30);
  const [windowOpen, setWindowOpen] = useState(false);
  const [data, setData] = useState<AttributionAnomalies | null>(null);
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
      const next = await fetchAttributionAnomalies(window);
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

  function copyId(id: string) {
    void navigator.clipboard.writeText(id).then(
      () => {
        setNotice("Copied event ID.");
      },
      () => {
        setNotice("Could not copy to the clipboard.");
      },
    );
  }

  const populated = data?.groups.filter((group) => group.total > 0) ?? [];

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
          <h1 className={managePageTitleClassName}>Anomalies</h1>
          <p className={managePageDescClassName}>
            Events that make a number wrong somewhere, and which ones they are.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <DropdownField
              label={
                <span
                  className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
                  id="anomaly-window-label"
                >
                  Window
                </span>
              }
              labelId="anomaly-window"
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
          <Link href={HEALTH_HREF} className={manageSecondaryButtonClassName}>
            Tracking health
          </Link>
        </div>
      </div>

      <div className={attributionNoteClassName}>
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {/* Scoped honestly: this is not "everything unusual", it is the set of
              faults that corrupt a figure. */}
          Every anomaly here corrupts a figure somewhere in this console. Nothing on this screen
          changes an event — the log is append-only, so these are read and worked around rather than
          corrected.
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
        <AnomaliesSkeleton />
      ) : data === null ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Anomalies found</span>
              <span
                className={`${attributionSignalValueClassName} ${
                  data.affectedTotal > 0 ? "text-[var(--admin-warning)]" : ""
                }`}
              >
                {data.affectedTotal.toLocaleString()}
              </span>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {/* Not called distinct, because it is not: one event can be both
                    future-dated and skewed, and five separate scans cannot say
                    how much they overlap. */}
                summed across kinds; an event can appear in two
              </p>
            </div>
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Kinds affected</span>
              <span className={attributionSignalValueClassName}>
                {populated.length} of {data.groups.length}
              </span>
            </div>
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Window</span>
              <span className={`${attributionSignalValueClassName} text-base`}>
                {data.days} days
              </span>
            </div>
          </div>

          {populated.length === 0 ? (
            <div className="admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center motion-safe:animate-[admin-fade-in_0.2s_ease-out]">
              <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
                Nothing corrupting the figures
              </h2>
              <ul className="mt-5 space-y-2.5 text-left">
                {data.groups.map((group) => (
                  <li key={group.kind} className="flex items-center gap-2.5">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-[var(--admin-success)]"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-[var(--admin-on-surface-variant)]">
                      {ANOMALY_COPY[group.kind].title}: none
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                {/* Scoped to the window that was actually scanned. */}
                Across the last {data.days} days. This says nothing about whether events are
                arriving at all — that is{" "}
                <Link
                  href={HEALTH_HREF}
                  className="font-semibold text-[var(--admin-primary)] hover:underline"
                >
                  tracking health
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {populated.map((group) => (
                <AnomalyGroup
                  key={group.kind}
                  kind={group.kind}
                  total={group.total}
                  truncated={group.truncated}
                  items={group.items}
                  sampleLimit={data.sampleLimit}
                  onCopy={copyId}
                />
              ))}
            </div>
          )}
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
            aria-label="Dismiss"
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

function AnomalyGroup({
  kind,
  total,
  truncated,
  items,
  sampleLimit,
  onCopy,
}: {
  kind: AttributionAnomalyKind;
  total: number;
  truncated: boolean;
  items: AttributionAnomalyEvent[];
  sampleLimit: number;
  onCopy: (id: string) => void;
}) {
  const copy = ANOMALY_COPY[kind];

  return (
    <section className={panelClassName}>
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">{copy.title}</h2>
          <span className={countChipClassName}>{total.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">{copy.why}</p>
        <p className="mt-2 text-sm text-[var(--admin-on-surface)]">{copy.fix}</p>
        {truncated ? (
          <p className="mt-2 text-sm font-semibold text-[var(--admin-warning)]">
            {/* Never let a capped sample read as the whole set. */}
            Showing {sampleLimit} of {total.toLocaleString()}.
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
                {kind === "duplicate" ? "Copies" : "Detail"}
              </th>
              <th className={attributionTableHeadCellClassName}>Event ID</th>
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
                  <AnomalyDetail kind={kind} event={event} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-data text-xs text-[var(--admin-on-surface-variant)]">
                      {event.id.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy event ID"
                      className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                      onClick={() => {
                        onCopy(event.id);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
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

/** The one column that differs per kind — the evidence for this row. */
function AnomalyDetail({
  kind,
  event,
}: {
  kind: AttributionAnomalyKind;
  event: AttributionAnomalyEvent;
}) {
  if (kind === "duplicate") {
    return (
      <span className="font-data tabular-nums text-[var(--admin-warning)]">
        {event.copies === null ? "—" : `${String(event.copies)}×`}
      </span>
    );
  }

  if (kind === "unrendered-placeholder") {
    // Name the field that carries the placeholder, not just the row.
    const offending = utmFields(event).find(
      (field) =>
        field.value !== null &&
        ["{{", "${", "%7b%7b"].some((needle) => field.value?.toLowerCase().includes(needle)),
    );
    return (
      <span className="font-data break-all text-[var(--admin-warning)]">
        {offending === undefined ? "—" : `${offending.key} = ${offending.value ?? ""}`}
      </span>
    );
  }

  if (kind === "revenue-without-currency") {
    return (
      <span className="font-data tabular-nums text-[var(--admin-on-surface)]">
        {event.revenueCents === null
          ? "—"
          : // Minor units, unlabelled: there is no currency to label it with,
            // which is the whole finding.
            `${(event.revenueCents / 100).toFixed(2)} (no currency)`}
      </span>
    );
  }

  return (
    <span className="font-data whitespace-nowrap text-[var(--admin-on-surface-variant)]">
      recorded {formatTimestamp(event.createdAt)}
    </span>
  );
}

function AnomaliesSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={attributionSignalCardClassName}>
            <div className="h-3 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }, (_, panel) => (
        <div key={panel} className={attributionTableShellClassName}>
          <div className="space-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="h-4 w-44 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          </div>
          {Array.from({ length: 3 }, (_, row) => (
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
  );
}
