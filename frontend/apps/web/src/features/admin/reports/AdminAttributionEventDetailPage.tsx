"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  RotateCcw,
  SearchX,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import { fetchAttributionEvent, type AttributionEventDetail } from "./attribution-api";
import {
  attributionNoteClassName,
  clockSkewMs,
  eventTypeChipClassName,
  formatDuration,
  formatRelative,
  formatRevenue,
  formatTimestamp,
  isAttributed,
  isNotableSkew,
  utmFields,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution/[eventId]`.
 *
 * One attribution event, read from a real single-event endpoint. It carries the
 * three columns the log's list DTO omits — `utm_term`, `utm_content` and the
 * metadata the beacon posted — which is the whole reason the screen exists: an
 * event attributed solely by `utm_term` reads as unattributed everywhere else
 * in the console.
 *
 * The record is immutable from here. Attribution events are written by the
 * marketing integrations and the sales beacon and are never edited, so there is
 * nothing on this page to press except copy and navigation.
 */

const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";
const MARKETING_INSIGHT_HREF = "/admin/insights/marketing-insight";

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export function AdminAttributionEventDetailPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<AttributionEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAttributionEvent(eventId);
      setEvent(next);
      setNotFound(false);
      setError(null);
    } catch (caught) {
      setEvent(null);
      // A missing event and an unreachable API need opposite recovery actions,
      // so they must not share a screen.
      if (caught instanceof ClientApiError && caught.status === 404) {
        setNotFound(true);
        setError(null);
      } else {
        setNotFound(false);
        setError(
          caught instanceof ClientApiError ? caught.message : "The event could not be read.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  function copyValue(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(
      () => {
        setNotice(`Copied ${label}.`);
      },
      () => {
        setNotice("Could not copy to the clipboard.");
      },
    );
  }

  return (
    <div className="space-y-5">
      <SalesMarketingReportTabs active="attribution" />

      <Link
        href={ATTRIBUTION_HREF}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Attribution events
      </Link>

      {loading ? (
        <EventDetailSkeleton />
      ) : notFound ? (
        <NotFoundPanel />
      ) : error !== null ? (
        <ErrorPanel
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      ) : event === null ? null : (
        <EventDetail event={event} onCopy={copyValue} />
      )}

      {notice !== null ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 motion-safe:animate-[admin-banner-in_0.18s_ease-out]"
        >
          <Check
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <span className="text-sm text-[var(--admin-on-surface)]">{notice}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-auto text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            onClick={() => {
              setNotice(null);
            }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EventDetail({
  event,
  onCopy,
}: {
  event: AttributionEventDetail;
  onCopy: (value: string, label: string) => void;
}) {
  const attributed = isAttributed(event);
  const skew = clockSkewMs(event.occurredAt, event.createdAt);
  const metadataEntries = Object.entries(event.metadataJson ?? {});

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={eventTypeChipClassName(event.revenueCents !== null)}>
              {event.eventType}
            </span>
          </div>
          <h1 className={`${managePageTitleClassName} font-data break-all`}>{event.eventType}</h1>
          <p className={`${managePageDescClassName} flex flex-wrap items-center gap-2`}>
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-data">{formatTimestamp(event.occurredAt)}</span>
            <span className="text-[var(--admin-on-surface-variant)]">
              ({formatRelative(event.occurredAt)})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            onClick={() => {
              onCopy(event.id, "event ID");
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy event ID
          </button>
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            onClick={() => {
              onCopy(JSON.stringify(event, null, 2), "the full record");
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy JSON
          </button>
          <Link href={MARKETING_INSIGHT_HREF} className={manageSecondaryButtonClassName}>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Marketing Insight
          </Link>
        </div>
      </div>

      <div className={attributionNoteClassName}>
        {/* The record is what the beacon posted. Nothing here can be corrected,
            and saying so is more useful than a disabled edit button. */}
        <span className="text-sm text-[var(--admin-on-surface-variant)]">
          Written by a marketing integration or the sales beacon. Attribution events are never
          edited or deleted, so this record is exactly what arrived.
        </span>
      </div>

      {!attributed ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
              No attribution captured
            </h2>
            {/* Checked against all five fields, which is why this claim is safe
                to make here and not on a log row. */}
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              None of the five UTM fields were present when this event was recorded. It counts
              toward totals but cannot be credited to a campaign. A visitor who typed the address in
              produces exactly this record, so one such event is not a fault.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Attribution</h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {/* Every field, present or not: an omitted row and an empty one
                    used to look the same. */}
                All five UTM fields as recorded, including the ones the event log cannot show.
              </p>
            </div>
            <dl className="divide-y divide-[var(--admin-border)]">
              {utmFields(event).map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between gap-4 px-5 py-3 motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_60%,transparent)]"
                >
                  <dt className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                    {field.key}
                  </dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    {field.value === null ? (
                      <span className="text-sm italic text-[var(--admin-on-surface-variant)]">
                        not set
                      </span>
                    ) : (
                      <>
                        <span className="font-data truncate text-sm text-[var(--admin-on-surface)]">
                          {field.value}
                        </span>
                        <button
                          type="button"
                          aria-label={`Copy ${field.key}`}
                          className="shrink-0 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                          onClick={() => {
                            onCopy(field.value ?? "", field.key);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Metadata</h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                Whatever the integration attached to the event. Free-form, so it varies by source.
              </p>
            </div>
            {metadataEntries.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                No metadata was attached to this event.
              </p>
            ) : (
              <dl className="divide-y divide-[var(--admin-border)]">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 px-5 py-3">
                    <dt className="font-data text-sm text-[var(--admin-on-surface-variant)]">
                      {key}
                    </dt>
                    <dd className="font-data min-w-0 break-all text-right text-sm text-[var(--admin-on-surface)]">
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Raw record</h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                {/* The actual response, not a prettified reconstruction — the
                    point of a raw panel is that it can be trusted verbatim. */}
                Exactly what the API returned for this event.
              </p>
            </div>
            <div className="overflow-x-auto bg-[var(--admin-surface-low)] p-5">
              <pre className="font-data text-xs leading-relaxed text-[var(--admin-on-surface)]">
                <code>{JSON.stringify(event, null, 2)}</code>
              </pre>
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Value</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <span className={fieldLabelClassName}>Revenue</span>
                <p className="font-data mt-1 text-lg tabular-nums text-[var(--admin-on-surface)]">
                  {formatRevenue(event.revenueCents, event.currency)}
                </p>
                {event.revenueCents !== null ? (
                  // Minor units spelled out, because a currency with a
                  // different exponent makes the divided figure ambiguous.
                  <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                    {event.revenueCents.toLocaleString()} minor units
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                    This event carries no amount — it is not a zero-value sale.
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--admin-border)] pt-4">
                <span className={fieldLabelClassName}>Learner</span>
                {event.membershipId === null ? (
                  <p className="mt-1 text-sm italic text-[var(--admin-on-surface-variant)]">
                    Not linked to a learner. The event was recorded before anyone signed in.
                  </p>
                ) : (
                  <Link
                    href={`/admin/members/${event.membershipId}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Open learner profile
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Timing</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <span className={fieldLabelClassName}>Occurred at</span>
                <p className="font-data mt-1 text-sm text-[var(--admin-on-surface)]">
                  {formatTimestamp(event.occurredAt)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Supplied by whatever posted the event.
                </p>
              </div>
              <div className="border-t border-[var(--admin-border)] pt-4">
                <span className={fieldLabelClassName}>Recorded at</span>
                <p className="font-data mt-1 text-sm text-[var(--admin-on-surface)]">
                  {formatTimestamp(event.createdAt)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  The server&apos;s own clock.
                </p>
              </div>
              {isNotableSkew(skew) && skew !== null ? (
                <div className="flex items-start gap-2 border-t border-[var(--admin-border)] pt-4">
                  {/* Only surfaced when it is large enough to move an event
                      into the wrong reporting day. */}
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-warning)]"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Recorded {formatDuration(skew)} {skew > 0 ? "after" : "before"} it reportedly
                    happened. Queued or replayed events land like this, and they can fall into the
                    wrong day in campaign reports.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className={panelTitleClassName}>Identifiers</h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <span className={fieldLabelClassName}>Event ID</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-data min-w-0 break-all text-xs text-[var(--admin-on-surface)]">
                    {event.id}
                  </span>
                  <button
                    type="button"
                    aria-label="Copy event ID"
                    className="shrink-0 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                    onClick={() => {
                      onCopy(event.id, "event ID");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {event.membershipId !== null ? (
                <div className="border-t border-[var(--admin-border)] pt-3">
                  <span className={fieldLabelClassName}>Membership ID</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-data min-w-0 break-all text-xs text-[var(--admin-on-surface)]">
                      {event.membershipId}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy membership ID"
                      className="shrink-0 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                      onClick={() => {
                        onCopy(event.membershipId ?? "", "membership ID");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

/** The id resolves to nothing in this academy. */
function NotFoundPanel() {
  return (
    <div className="admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center motion-safe:animate-[admin-fade-in_0.2s_ease-out]">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
        <SearchX className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">No such event</h1>
      {/* A real 404 from a real lookup. This used to mean "not in the rows the
          screen happened to have loaded", which was a different claim entirely
          and sent people hunting through pages for a row that never existed. */}
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        No attribution event with this ID exists in this academy. The link may be stale, or the ID
        may belong somewhere else.
      </p>
      <Link href={ATTRIBUTION_HREF} className={`${manageSecondaryButtonClassName} mt-6`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to attribution events
      </Link>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3"
    >
      <span className="text-sm font-semibold text-[var(--admin-danger)]">{message}</span>
      <button type="button" onClick={onRetry} className={manageSecondaryButtonClassName}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

function EventDetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-5 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        <div className="h-8 w-56 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        <div className="h-3 w-72 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {Array.from({ length: 2 }, (_, panel) => (
            <div key={panel} className={panelClassName}>
              <div className={panelHeaderClassName}>
                <div className="h-4 w-32 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
              </div>
              {Array.from({ length: 5 }, (_, row) => (
                <div
                  key={row}
                  className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3"
                >
                  <div className="h-3.5 w-28 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                  <div
                    className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                    style={{ width: `${String(20 + ((row * 9) % 25))}%` }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-5">
          {Array.from({ length: 3 }, (_, panel) => (
            <div key={panel} className={panelClassName}>
              <div className={panelHeaderClassName}>
                <div className="h-4 w-24 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="h-3 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                <div className="h-5 w-32 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
