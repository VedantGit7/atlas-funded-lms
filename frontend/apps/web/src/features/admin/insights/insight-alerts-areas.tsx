"use client";

import Link from "next/link";
import { EyeOff, Radio, ShieldAlert } from "lucide-react";
import {
  adminInsightAlertsHref,
  adminInsightChannelsHref,
  adminInsightHref,
  adminInsightInboxHref,
  adminInsightWhatsappHref,
} from "./admin-insights-catalog";
import type { InsightAlertRuleCard, InsightAlertsBoard } from "./admin-insights-api";
import { formatInsightNumber, formatRelativeTime } from "./admin-insights-format";
import {
  insightPanelClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
} from "./admin-insights-shared";
import { AlertsCallout } from "./insight-alerts-kit";
import { genericAlertsArea, type InsightAlertsArea } from "./InsightAlertsView";

/* Sales Insight */

const FAILED_PAYMENTS = "failed-payments";

export const salesInsightAlertsArea: InsightAlertsArea = {
  severities: ["critical", "warning", "info"],
  ruleColumn: "rule",
  linkAllAlerts: true,
  tiles: ["open", "critical", "new", "resolved", "rules"],
  resolvedTimeframes: { options: ["24h", "7d", "30d"], initial: "7d" },
  resolvedSeverityFilter: true,
  thresholdLabel: (rule) => {
    if (rule.id === "low-conversion") return "Target (%)";
    if (rule.id === "pending-orders") return "Orders (N)";
    return "Threshold (N)";
  },
  mutedWarning: (items) =>
    items.some((item) => item.ruleId === FAILED_PAYMENTS) ? (
      <AlertsCallout tone="warning">
        Failed payments is muted. Revenue recovery will stay off the Open list until you unmute it.
      </AlertsCallout>
    ) : null,
  muteWarning: (ruleId) =>
    ruleId === FAILED_PAYMENTS
      ? "Muting failed payments hides a revenue-affecting signal. Consider raising the threshold instead."
      : null,
};

/* Live Dashboard */

function LiveRuleEvaluation({ board }: { board: InsightAlertsBoard }) {
  return (
    <div className={`${insightPanelClassName} gap-3 p-5`}>
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
        <Radio className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
        Rule evaluation
      </h3>
      <p className="text-sm text-[var(--admin-on-surface-variant)]">
        Rules are evaluated against the live session stream. Informational rules do not escalate.
      </p>
      <div className="rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Last evaluated
          </span>
          <span className="font-data text-sm font-semibold text-[var(--admin-on-surface)]">
            {formatRelativeTime(board.generatedAt)}
          </span>
        </div>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">
          {formatInsightNumber(board.rules.filter((rule) => rule.enabled).length)} of{" "}
          {formatInsightNumber(board.rules.length)} rules enabled
        </p>
      </div>
    </div>
  );
}

export const liveDashboardAlertsArea: InsightAlertsArea = {
  severities: ["critical", "warning", "info"],
  ruleColumn: "rule",
  linkAllAlerts: true,
  rulesHeader: {
    title: "Alert rules",
    description:
      "Manage live-session alert thresholds and informational notices. Changes apply immediately to the monitoring stream.",
  },
  resolvedTimeframes: { options: ["7d", "30d", "90d"], initial: "7d" },
  ruleNote: (rule) => {
    if (rule.id === "low-attendance") {
      return "The 50% attendance floor is fixed and not configurable.";
    }
    if (rule.id === "upcoming-live") {
      return "This rule is informational and clears itself once sessions end.";
    }
    return "Threshold changes apply to the next evaluation cycle.";
  },
  rulesAside: (board) => <LiveRuleEvaluation board={board} />,
};

/* Marketing Insight */

/** Both Marketing rules raise warnings only, so open alerts are grouped by the rule that raised them. */
export const marketingInsightAlertsArea: InsightAlertsArea = {
  severities: ["warning"],
  ruleColumn: "rule",
  linkAllAlerts: true,
  groupOpenBy: "rule",
  thresholdLabel: (rule) => {
    if (rule.id === "no-form-submissions-30d") return "Minimum live forms";
    if (rule.thresholdKind === "percent") return "Warning threshold (%)";
    return "Threshold (N)";
  },
  ruleNote: (rule) => {
    if (rule.id === "no-form-submissions-30d") return "This rule only considers live forms.";
    if (rule.id === "low-cta-click-rate") {
      return "Needs a minimum view count before it can fire, so a brand-new CTA does not trip it.";
    }
    return null;
  },
};

/* Messenger Insight */

const WHATSAPP_FAILURES = "whatsapp-failures";
const WHATSAPP_DISCONNECTED = "whatsapp-disconnected";

function MessengerLocalTabs({ slug }: { slug: string }) {
  const tabs = [
    { href: adminInsightHref(slug), label: "Overview" },
    { href: adminInsightChannelsHref(slug), label: "Channels" },
    { href: adminInsightWhatsappHref(slug), label: "WhatsApp" },
    { href: adminInsightInboxHref(slug), label: "Inbox" },
  ];
  return (
    <div
      className={`${insightSegmentTrackClassName} w-fit`}
      role="tablist"
      aria-label="Messenger modules"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          prefetch={false}
          className={insightSegmentButtonClassName}
        >
          {tab.label}
        </Link>
      ))}
      <Link
        href={adminInsightAlertsHref(slug)}
        prefetch={false}
        className={insightSegmentButtonActiveClassName}
        aria-current="page"
      >
        Alerts
      </Link>
    </div>
  );
}

function messengerRuleText(rule: InsightAlertRuleCard): string {
  if (rule.id === WHATSAPP_FAILURES) {
    return `Notify on any failed send; raise it to a warning at ${rule.threshold} or more.`;
  }
  return rule.description;
}

/** Both Messenger rules watch WhatsApp; the page says plainly which channels nothing watches. */
export const messengerInsightAlertsArea: InsightAlertsArea = {
  severities: ["warning", "info"],
  ruleColumn: "rule",
  linkAllAlerts: true,
  description: "What Messenger Insight is flagging, and what it does not watch.",
  localNav: (slug) => <MessengerLocalTabs slug={slug} />,
  notice: (
    <AlertsCallout tone="neutral">
      <p>Both rules in this section watch WhatsApp.</p>
      <p className="mt-1">
        Email, push, announcements and the inbox have no alert rules, so no alert fires for them
        however they perform.
      </p>
    </AlertsCallout>
  ),
  tileCaptions: {
    rules: () => (
      <span className="inline-flex items-center gap-1">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Both watch WhatsApp
      </span>
    ),
  },
  emptyOpenBody: () => "Both rules watch WhatsApp, and neither is firing.",
  mutedWarning: () => (
    <AlertsCallout tone="warning">
      Muting WhatsApp failures hides the only delivery signal this section watches.
    </AlertsCallout>
  ),
  ruleText: messengerRuleText,
  ruleNote: (rule) =>
    rule.id === WHATSAPP_DISCONNECTED
      ? "This rule has no threshold. It fires whenever the integration is disconnected."
      : null,
  rulesFooter: (
    <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))] px-4 py-5">
      <div className="flex items-start gap-3">
        <EyeOff
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
        <div>
          <h4 className="text-base font-semibold text-[var(--admin-on-surface)]">Coverage gap</h4>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            No rules watch email, push, announcements, or the inbox.
          </p>
        </div>
      </div>
    </div>
  ),
};

const AREAS: Record<string, InsightAlertsArea> = {
  "sales-insight": salesInsightAlertsArea,
  "live-dashboard": liveDashboardAlertsArea,
  "marketing-insight": marketingInsightAlertsArea,
  "messenger-insight": messengerInsightAlertsArea,
};

/** The alerts page spec for an Insights section; School Vitals and the Dashboard share the generic one. */
export function insightAlertsArea(slug: string): InsightAlertsArea {
  return AREAS[slug] ?? genericAlertsArea;
}
