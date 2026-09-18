"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Info,
  Lock,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { SalesMarketingReportTabs } from "./SalesMarketingReportTabs";
import { fetchAttributionSummary, type AttributionSummary } from "./attribution-api";
import { AttributionRetentionPanel } from "./AttributionRetentionPanel";
import {
  fetchAttributionExportRules,
  fetchAttributionRetention,
  fetchAttributionSnippets,
  type AttributionExportRules,
  type AttributionRetention,
  type AttributionSnippets,
  type SectionResult,
} from "./attribution-settings-api";
import {
  attributionNoteClassName,
  attributionSignalCardClassName,
  attributionSignalLabelClassName,
  attributionSignalValueClassName,
  attributedPercent,
  formatRelative,
  formatTimestamp,
} from "./attribution-shared";

/**
 * `/admin/reports/sales-marketing/attribution/settings`.
 *
 * There is no attribution-specific configuration in this system — no attribution
 * window, no model toggle, no per-tenant tracking switch — so this screen does
 * not invent any. What genuinely governs the log lives in two places that
 * already have their own editors, and a second editor for either would
 * guarantee the two drift. This reads the current state, says where each thing
 * is changed, and states plainly which behaviours are fixed in code.
 *
 * The three reads sit behind three different permissions, so each section
 * degrades on its own: a reports-only operator can still see whether events are
 * arriving even when the tracking configuration is refused.
 */

const ATTRIBUTION_HREF = "/admin/reports/sales-marketing/attribution";
const INTEGRATIONS_HREF = "/admin/marketing/integrations";
const EXPORT_SETTINGS_HREF = "/admin/reports/exports/settings";

/**
 * How stale the newest event has to be before it is worth alarming about.
 *
 * A quiet weekend is not a broken beacon. Two days without a single event on a
 * log that has events in it is a different matter.
 */
const STALE_BEACON_MS = 48 * 60 * 60 * 1000;

const panelClassName =
  "admin-glass overflow-hidden rounded-xl border border-[var(--admin-border)] motion-safe:animate-[admin-fade-in_0.2s_ease-out]";

const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3.5";

const panelTitleClassName = "text-sm font-bold text-[var(--admin-on-surface)]";

const rowClassName =
  "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-3.5 last:border-b-0";

const labelClassName = "text-sm font-semibold text-[var(--admin-on-surface)]";

const hintClassName = "mt-0.5 text-xs text-[var(--admin-on-surface-variant)]";

export function AdminAttributionSettingsPage() {
  const [summary, setSummary] = useState<SectionResult<AttributionSummary> | null>(null);
  const [snippets, setSnippets] = useState<SectionResult<AttributionSnippets> | null>(null);
  const [rules, setRules] = useState<SectionResult<AttributionExportRules> | null>(null);
  const [retention, setRetention] = useState<SectionResult<AttributionRetention> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Independent on purpose: one refused section must not blank the others.
    const [summaryResult, snippetResult, ruleResult] = await Promise.all([
      fetchAttributionSummary({}).then(
        (data): SectionResult<AttributionSummary> => ({ kind: "ok", data }),
        (caught: unknown): SectionResult<AttributionSummary> =>
          caught instanceof ClientApiError && (caught.status === 403 || caught.status === 401)
            ? { kind: "forbidden" }
            : {
                kind: "error",
                message: caught instanceof ClientApiError ? caught.message : "Could not be read.",
              },
      ),
      fetchAttributionSnippets(),
      fetchAttributionExportRules(),
    ]);
    setSummary(summaryResult);
    setSnippets(snippetResult);
    setRules(ruleResult);
    setRetention(await fetchAttributionRetention());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          <h1 className={managePageTitleClassName}>Attribution settings</h1>
          <p className={managePageDescClassName}>
            What governs the attribution log, and where each part of it is changed.
          </p>
        </div>
        <button
          type="button"
          className={manageSecondaryButtonClassName}
          disabled={loading}
          onClick={() => {
            void load();
          }}
        >
          <RotateCcw
            className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      <div className={attributionNoteClassName}>
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        {/* The honest framing. Pretending there are attribution knobs here would
            mean building a second editor for settings that already have one. */}
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Attribution has no settings of its own. Everything below is read from where it actually
          lives — nothing on this page is edited here, and each row links to the one screen that
          owns it.
        </p>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <IncomingEventsPanel result={summary} />
          <AttributionRetentionPanel
            result={retention}
            onChanged={() => {
              void load();
            }}
          />
          <TrackingPanel result={snippets} />
          <ExportRulesPanel result={rules} />
          <FixedBehaviourPanel />
        </div>
      )}
    </div>
  );
}

/** Whether events are arriving at all — the only real diagnostic on this page. */
function IncomingEventsPanel({ result }: { result: SectionResult<AttributionSummary> | null }) {
  if (result === null) return null;
  if (result.kind !== "ok") {
    return <SectionFallback title="Incoming events" result={result} permission="reports.run" />;
  }

  const summary = result.data;
  const percent = attributedPercent(summary.attributed, summary.total);
  const lastAt = summary.lastOccurredAt;
  const stale =
    lastAt !== null && summary.total > 0 && Date.now() - Date.parse(lastAt) > STALE_BEACON_MS;

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>Incoming events</h2>
        <p className={hintClassName}>
          Whether the beacon and the marketing integrations are actually posting.
        </p>
      </div>

      {summary.total === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">
          No attribution events have ever been recorded. Until one arrives, nothing on this page can
          tell you whether tracking works — check the snippets alongside.
        </p>
      ) : (
        <>
          {stale ? (
            <div className="flex items-start gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-5 py-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                aria-hidden="true"
              />
              {/* A quiet weekend is not a broken beacon; two silent days on a
                  log that has events in it is worth a look. */}
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {/* `stale` already proved this is a real timestamp. */}
                Nothing has arrived for {formatRelative(lastAt)}. If the site has had traffic since,
                the tracking snippets are the first thing to check.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 p-5">
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Events recorded</span>
              <span className={attributionSignalValueClassName}>
                {summary.total.toLocaleString()}
              </span>
            </div>
            <div className={attributionSignalCardClassName}>
              <span className={attributionSignalLabelClassName}>Carrying attribution</span>
              <span className={attributionSignalValueClassName}>
                {/* An empty log is not 0% attributed; it has no percentage. */}
                {percent === null ? "—" : `${String(percent)}%`}
              </span>
            </div>
          </div>

          <div className={rowClassName}>
            <div>
              <span className={labelClassName}>Most recent event</span>
              <p className={hintClassName}>
                {lastAt === null ? "—" : `${formatTimestamp(lastAt)} (${formatRelative(lastAt)})`}
              </p>
            </div>
            <Link
              href={ATTRIBUTION_HREF}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
            >
              Open the log
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

/** The three script slots that fire the beacon. Read only — edited elsewhere. */
function TrackingPanel({ result }: { result: SectionResult<AttributionSnippets> | null }) {
  if (result === null) return null;
  if (result.kind !== "ok") {
    return <SectionFallback title="Tracking snippets" result={result} permission="config.update" />;
  }

  const snippets = result.data;
  const slots = [
    {
      label: "Site-wide",
      value: snippets.siteBodyHtml,
      hint: "Runs on every public page. Where a tag manager or analytics loader usually goes.",
    },
    {
      label: "Order tracking",
      value: snippets.orderTrackingHtml,
      hint: "Runs after a completed purchase.",
    },
    {
      label: "Signup tracking",
      value: snippets.signupTrackingHtml,
      hint: "Runs after a learner signs up.",
    },
  ];
  const configured = slots.filter((slot) => (slot.value ?? "").trim() !== "").length;

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>Tracking snippets</h2>
        <p className={hintClassName}>
          {configured} of {slots.length} configured
          {snippets.updatedAt === null
            ? ""
            : ` · last changed ${formatRelative(snippets.updatedAt)}`}
        </p>
      </div>

      {slots.map((slot) => {
        const set = (slot.value ?? "").trim() !== "";
        return (
          <div key={slot.label} className={rowClassName}>
            <div className="min-w-0">
              <span className={labelClassName}>{slot.label}</span>
              <p className={hintClassName}>{slot.hint}</p>
            </div>
            {/* Configured or not, never the content: a snippet is arbitrary
                script and this screen has no reason to render it. */}
            <span
              className={
                set
                  ? "font-data inline-flex shrink-0 items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--admin-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-success)]"
                  : "font-data inline-flex shrink-0 items-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
              }
            >
              {set ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
              {set ? "Set" : "Empty"}
            </span>
          </div>
        );
      })}

      <div className="border-t border-[var(--admin-border)] p-5">
        <Link
          href={INTEGRATIONS_HREF}
          className={`${manageSecondaryButtonClassName} w-full justify-center`}
        >
          Edit in Marketing integrations
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/** Retention and personal-data rules that apply to attribution exports. */
function ExportRulesPanel({ result }: { result: SectionResult<AttributionExportRules> | null }) {
  if (result === null) return null;
  if (result.kind !== "ok") {
    return (
      <SectionFallback title="Export rules" result={result} permission="reports.library.view" />
    );
  }

  const rules = result.data;
  // The two the attribution export actually carries. The shared settings cover
  // seven fields; listing the five this dataset has no column for would be
  // padding.
  const treatments = [
    { key: "learner_name", label: "Learner name" },
    { key: "email", label: "Email" },
  ];

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>Export rules</h2>
        <p className={hintClassName}>
          Tenant-wide export settings, applied to attribution exports like every other dataset.
        </p>
      </div>

      <div className={rowClassName}>
        <div>
          <span className={labelClassName}>Downloaded files kept</span>
          <p className={hintClassName}>After that the file is purged; the run record remains.</p>
        </div>
        <span className="font-data shrink-0 text-sm text-[var(--admin-on-surface)]">
          {rules.fileRetentionValue} {rules.fileRetentionUnit}
        </span>
      </div>

      <div className={rowClassName}>
        <div>
          <span className={labelClassName}>Run history kept</span>
          <p className={hintClassName}>Who exported what, and when.</p>
        </div>
        <span className="font-data shrink-0 text-sm text-[var(--admin-on-surface)]">
          {rules.runRecordRetention}
        </span>
      </div>

      <div className={rowClassName}>
        <div>
          <span className={labelClassName}>Maximum rows per export</span>
          <p className={hintClassName}>
            {/* Two different ceilings, and conflating them would confuse a
                truncated download with a scheduled one. */}
            Applies to scheduled exports. The one-shot download from the log has its own, separate
            ceiling.
          </p>
        </div>
        <span className="font-data shrink-0 text-sm text-[var(--admin-on-surface)]">
          {rules.maxRowsPerExport.toLocaleString()}
        </span>
      </div>

      {treatments.map((treatment) => (
        <div key={treatment.key} className={rowClassName}>
          <div>
            <span className={labelClassName}>{treatment.label} in exports</span>
            <p className={hintClassName}>
              Attribution exports can carry this column; this is how it is written.
            </p>
          </div>
          <span className="font-data shrink-0 text-sm text-[var(--admin-on-surface)]">
            {rules.personalDataTreatments[treatment.key] ?? "—"}
          </span>
        </div>
      ))}

      <div className="border-t border-[var(--admin-border)] p-5">
        <Link
          href={EXPORT_SETTINGS_HREF}
          className={`${manageSecondaryButtonClassName} w-full justify-center`}
        >
          Edit export settings
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/**
 * What is fixed in code.
 *
 * Stating this is the point of the panel. An operator looking for an
 * attribution-window setting will otherwise keep looking, and the honest answer
 * is that there is not one.
 */
function FixedBehaviourPanel() {
  const facts = [
    {
      label: "Attribution model",
      value: "First touch",
      hint: "Revenue is credited to the source on the learner's first tracked event. A learner with no tracked source appears under Direct. This is not configurable.",
    },
    {
      label: "Event log",
      value: "Append only",
      hint: "Events are written by the marketing integrations and the sales beacon. Nothing in this console edits or deletes them, which is what makes the log usable as a record.",
    },
    {
      label: "Attribution window",
      value: "None",
      hint: "There is no lookback window: an event carries whatever UTM parameters were present when it was recorded, and nothing re-attributes it later.",
    },
  ];

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>Fixed behaviour</h2>
        <p className={hintClassName}>Decided in code, not configurable per academy.</p>
      </div>
      {facts.map((fact) => (
        <div key={fact.label} className={rowClassName}>
          <div className="min-w-0 flex-1">
            <span className={labelClassName}>{fact.label}</span>
            <p className={hintClassName}>{fact.hint}</p>
          </div>
          <span className="font-data inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            <Lock className="h-3 w-3" aria-hidden="true" />
            {fact.value}
          </span>
        </div>
      ))}
    </section>
  );
}

/**
 * A section that was refused or failed.
 *
 * Refusal and failure get different words on purpose: rendering "could not
 * load" over a permission boundary sends an operator hunting for an outage that
 * does not exist.
 */
function SectionFallback({
  title,
  result,
  permission,
}: {
  title: string;
  result: { kind: "forbidden" } | { kind: "error"; message: string };
  permission: string;
}) {
  const forbidden = result.kind === "forbidden";
  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>{title}</h2>
      </div>
      <div className="flex items-start gap-3 px-5 py-6">
        {forbidden ? (
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
        ) : (
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
        )}
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {forbidden ? (
            <>
              Your role cannot read this. It needs{" "}
              <span className="font-data text-[var(--admin-on-surface)]">{permission}</span>. The
              rest of this page is unaffected.
            </>
          ) : (
            result.message
          )}
        </p>
      </div>
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }, (_, panel) => (
        <div key={panel} className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div className="h-4 w-36 rounded bg-[var(--admin-surface)] motion-safe:animate-pulse" />
          </div>
          {Array.from({ length: 3 }, (_, row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] px-5 py-4"
            >
              <div className="space-y-2">
                <div className="h-3.5 w-32 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
                <div
                  className="h-3 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
                  style={{ width: `${String(140 + ((row * 30) % 90))}px` }}
                />
              </div>
              <div className="h-5 w-16 rounded-md bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
